"use server";

import { revalidatePath } from "next/cache";
import { getActionUser } from "@/features/auth/server";
import { prisma } from "@/lib/prisma";
import { createTeamSchema } from "./validation";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Creates a new team workspace inside an atomic transaction.
 * 1. Creates Team with caller as ownerId.
 * 2. Links caller as TeamMember with role = OWNER (BR-TEAM-01, BR-TEAM-02).
 * 3. Updates caller's lastActiveTeamId to the newly created team.
 * 4. Writes an immutable ActivityLog entry (REQ-LOG-01, BR-AUDIT-01).
 */
export async function createTeamAction(
  input: unknown
): Promise<ActionResult<{ teamId: string; name: string }>> {
  const user = await getActionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = createTeamSchema.safeParse(input);

  if (!parseResult.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parseResult.error.issues) {
      const field = issue.path[0] as string;
      if (field) {
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(issue.message);
      }
    }
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors,
    };
  }

  const { name, description } = parseResult.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Team record
      const team = await tx.team.create({
        data: {
          name,
          description: description || null,
          ownerId: user.id,
        },
      });

      // 2. Link creator as OWNER in team_member
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      // 3. Set lastActiveTeamId as navigation preference
      await tx.user.update({
        where: { id: user.id },
        data: { lastActiveTeamId: team.id },
      });

      // 4. Record ActivityLog
      await tx.activityLog.create({
        data: {
          teamId: team.id,
          actorId: user.id,
          action: "team_created",
          metadata: {
            teamName: team.name,
          },
        },
      });

      return team;
    });

    revalidatePath("/teams");
    revalidatePath(`/teams/${result.id}`);

    return {
      success: true,
      data: {
        teamId: result.id,
        name: result.name,
      },
    };
  } catch {
    return {
      success: false,
      error: "Failed to create team. Please try again.",
    };
  }
}

/**
 * Updates user's lastActiveTeamId preference after validating active membership.
 * Enforces BR-CTX-01: lastActiveTeamId is strictly a navigation preference.
 */
export async function switchTeamAction(
  teamId: string
): Promise<ActionResult<{ teamId: string }>> {
  const user = await getActionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  // Authoritative check: verify active membership in targeted team
  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: user.id,
      },
    },
    include: {
      team: true,
    },
  });

  if (!membership || membership.team.deletedAt !== null) {
    return {
      success: false,
      error: "You are not an active member of this team.",
    };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveTeamId: teamId },
    });

    return {
      success: true,
      data: { teamId },
    };
  } catch {
    return {
      success: false,
      error: "Failed to update team preference.",
    };
  }
}
