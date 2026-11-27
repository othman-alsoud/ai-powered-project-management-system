"use server";

import { getActionUser } from "@/features/auth/server";
import type { ActionResult } from "@/features/teams/actions";
import { prisma } from "@/lib/prisma";
import { queryTeamActivityFeed } from "./server";
import type { ActivityFeedPage } from "./types";
import {
  activityFeedQuerySchema,
  activityFieldErrorsFromZod,
  isValidUuid,
  type ActivityFeedQueryInput,
} from "./validation";

/**
 * Read-only Server Action for loading paginated team activity (used for
 * client pagination and refreshes while preserving strict team isolation).
 */
export async function getTeamActivityAction(
  teamId: string,
  input: ActivityFeedQueryInput = {},
): Promise<ActionResult<ActivityFeedPage>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  if (!isValidUuid(teamId)) {
    return {
      success: false,
      error: "Invalid team ID.",
    };
  }

  const parsed = activityFeedQuerySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: activityFieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const [activeUser, activeTeam, membership] = await Promise.all([
      prisma.user.findFirst({
        where: { id: user.id, deletedAt: null },
        select: { id: true },
      }),
      prisma.team.findFirst({
        where: { id: teamId, deletedAt: null },
        select: { id: true },
      }),
      prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: user.id } },
        select: { role: true },
      }),
    ]);

    if (!activeUser) {
      return {
        success: false,
        error: "This account is no longer active.",
      };
    }

    if (!activeTeam || !membership) {
      return {
        success: false,
        error: "Team not found.",
      };
    }

    if (parsed.data.projectId) {
      const activeProject = await prisma.project.findFirst({
        where: {
          id: parsed.data.projectId,
          teamId,
          deletedAt: null,
          team: { deletedAt: null },
        },
        select: { id: true },
      });
      if (!activeProject) {
        return {
          success: false,
          error: "Project not found.",
        };
      }
    }

    if (parsed.data.taskId) {
      const activeTask = await prisma.task.findFirst({
        where: {
          id: parsed.data.taskId,
          teamId,
          deletedAt: null,
          team: { deletedAt: null },
          project: { deletedAt: null },
        },
        select: { id: true },
      });
      if (!activeTask) {
        return {
          success: false,
          error: "Task not found.",
        };
      }
    }

    const page = await queryTeamActivityFeed(teamId, parsed.data);
    return {
      success: true,
      data: page,
    };
  } catch (error) {
    console.error("[getTeamActivityAction] Failed to load activity:", error);
    return {
      success: false,
      error: "Unable to load team activity. Please try again.",
    };
  }
}
