"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { recordActivityLog } from "@/features/activity/writer";
import { getActionUser } from "@/features/auth/server";
import { notifyProjectTerminalStatus } from "@/features/notifications/writer";
import type { ActionResult } from "@/features/teams/actions";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { areUtcDatesEqual, toUtcDateInputValue } from "./date-utils";
import type { ProjectStatus } from "./server";
import {
  createProjectSchema,
  deleteProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from "./validation";

class ProjectFieldError extends Error {
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

function formatZodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field.length > 0) {
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(issue.message);
    }
  }
  return fieldErrors;
}

function sanitizeProjectActionError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    const isDomainError =
      error.message.startsWith("Forbidden:") ||
      error.message.startsWith("This account is no longer active") ||
      error.message.startsWith("Project not found");

    if (isDomainError) {
      return error.message;
    }
  }

  return fallbackMessage;
}

async function assertActiveManagerAndUser(
  tx: Prisma.TransactionClient,
  teamId: string,
  userId: string
): Promise<void> {
  const activeUser = await tx.user.findUnique({
    where: { id: userId },
  });

  if (!activeUser || activeUser.deletedAt !== null) {
    throw new Error("This account is no longer active.");
  }

  const membership = await tx.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
    include: {
      team: true,
    },
  });

  if (!membership || membership.team.deletedAt !== null) {
    throw new Error("Forbidden: Not an active member of this team.");
  }

  if (membership.role !== "OWNER" && membership.role !== "MANAGER") {
    throw new Error(
      "Forbidden: Only team owners and managers can manage projects."
    );
  }
}

async function lockAndLoadExistingProject(
  tx: Prisma.TransactionClient,
  teamId: string,
  projectId: string,
  userId: string
) {
  await tx.$queryRaw`SELECT id FROM "team" WHERE id = ${teamId} FOR NO KEY UPDATE`;
  await tx.$queryRaw`SELECT id FROM "project" WHERE id = ${projectId} AND "teamId" = ${teamId} FOR NO KEY UPDATE`;
  await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId} FOR NO KEY UPDATE`;

  await assertActiveManagerAndUser(tx, teamId, userId);

  const existingProject = await tx.project.findUnique({
    where: {
      id_teamId: {
        id: projectId,
        teamId,
      },
    },
  });

  if (!existingProject || existingProject.deletedAt !== null) {
    throw new Error("Project not found.");
  }

  return existingProject;
}

async function dispatchProjectTerminalNotification(
  tx: Prisma.TransactionClient,
  params: {
    teamId: string;
    actorId: string;
    projectId: string;
    projectName: string;
    previousStatus: ProjectStatus;
    nextStatus: ProjectStatus;
  },
): Promise<void> {
  if (
    params.previousStatus === params.nextStatus ||
    (params.nextStatus !== "COMPLETED" && params.nextStatus !== "CANCELLED")
  ) {
    return;
  }

  const assignedTasks = await tx.task.findMany({
    where: {
      teamId: params.teamId,
      projectId: params.projectId,
      deletedAt: null,
      assignedToId: { not: null },
    },
    select: { assignedToId: true },
    distinct: ["assignedToId"],
  });

  const sortedCandidateIds = Array.from(
    new Set(
      assignedTasks
        .map((task) => task.assignedToId)
        .filter(
          (uid): uid is string =>
            typeof uid === "string" && uid.length > 0 && uid !== params.actorId,
        ),
    ),
  ).sort();

  if (sortedCandidateIds.length === 0) {
    return;
  }

  // Acquire FOR KEY SHARE in ascending user-ID order so concurrent account deletion
  // (user FOR UPDATE) serializes before deletedAt/membership checks without deadlocking
  // against FOR NO KEY UPDATE locks held by other actions.
  for (const candidateUserId of sortedCandidateIds) {
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${candidateUserId}::uuid FOR KEY SHARE`;
  }

  const activeUsers = await tx.user.findMany({
    where: {
      id: { in: sortedCandidateIds },
      deletedAt: null,
    },
    select: { id: true },
  });

  const activeUserIds = activeUsers.map((u) => u.id);
  if (activeUserIds.length === 0) {
    return;
  }

  const activeMembers = await tx.teamMember.findMany({
    where: {
      teamId: params.teamId,
      userId: { in: activeUserIds },
      user: { deletedAt: null },
    },
    select: { userId: true },
  });

  await notifyProjectTerminalStatus(tx, {
    teamId: params.teamId,
    actorId: params.actorId,
    projectId: params.projectId,
    projectName: params.projectName,
    status: params.nextStatus,
    recipientUserIds: activeMembers.map((member) => member.userId),
  });
}

/**
 * Creates a new project scoped to a team (OWNER or MANAGER only).
 * Lock order: "team" (FOR NO KEY UPDATE) -> "user" (FOR NO KEY UPDATE).
 */
export async function createProjectAction(
  input: unknown
): Promise<ActionResult<{ projectId: string; name: string; status: ProjectStatus }>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = createProjectSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: formatZodFieldErrors(parseResult.error),
    };
  }

  const { teamId, name, description, status, startDate, endDate } = parseResult.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "team" WHERE id = ${teamId} FOR NO KEY UPDATE`;
      await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${user.id} FOR NO KEY UPDATE`;

      await assertActiveManagerAndUser(tx, teamId, user.id);

      const project = await tx.project.create({
        data: {
          teamId,
          name,
          description,
          status,
          startDate,
          endDate,
          createdById: user.id,
        },
      });

      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        projectId: project.id,
        action: "project_created",
        metadata: {
          projectName: project.name,
          status: project.status,
          startDate: toUtcDateInputValue(project.startDate) || null,
          endDate: toUtcDateInputValue(project.endDate) || null,
        },
      });

      return project;
    });

    revalidatePath(`/teams/${teamId}`);
    revalidatePath(`/teams/${teamId}/projects`);

    return {
      success: true,
      data: {
        projectId: created.id,
        name: created.name,
        status: created.status,
      },
    };
  } catch (error) {
    console.error("[createProjectAction] Failed to create project:", error);
    return {
      success: false,
      error: sanitizeProjectActionError(
        error,
        "Failed to create project. Please try again."
      ),
    };
  }
}

/**
 * Updates a project's details, status, or dates (OWNER or MANAGER only).
 * Lock order: "team" -> "project" (id AND teamId) -> "user" (all FOR NO KEY UPDATE).
 */
export async function updateProjectAction(
  input: unknown
): Promise<ActionResult<{ projectId: string; name: string; status: ProjectStatus }>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = updateProjectSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: formatZodFieldErrors(parseResult.error),
    };
  }

  const { teamId, projectId, name, description, status, startDate, endDate } =
    parseResult.data;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await lockAndLoadExistingProject(
        tx,
        teamId,
        projectId,
        user.id
      );

      const nextName = name;
      const nextDescription =
        description !== undefined ? description : existing.description;
      const nextStatus = status !== undefined ? status : existing.status;
      const nextStartDate =
        startDate !== undefined ? startDate : existing.startDate;
      const nextEndDate = endDate !== undefined ? endDate : existing.endDate;

      if (
        nextStartDate &&
        nextEndDate &&
        nextEndDate.getTime() < nextStartDate.getTime()
      ) {
        throw new ProjectFieldError("Validation failed.", {
          endDate: ["End date cannot be earlier than start date."],
        });
      }

      const changedFields: string[] = [];
      if (nextName !== existing.name) changedFields.push("name");
      if (nextDescription !== existing.description) changedFields.push("description");
      if (nextStatus !== existing.status) changedFields.push("status");
      if (!areUtcDatesEqual(nextStartDate, existing.startDate)) {
        changedFields.push("startDate");
      }
      if (!areUtcDatesEqual(nextEndDate, existing.endDate)) {
        changedFields.push("endDate");
      }

      if (changedFields.length === 0) {
        return {
          changed: false as const,
          project: existing,
        };
      }

      const updated = await tx.project.update({
        where: {
          id_teamId: {
            id: projectId,
            teamId,
          },
        },
        data: {
          name: nextName,
          description: nextDescription,
          status: nextStatus,
          startDate: nextStartDate,
          endDate: nextEndDate,
          updatedById: user.id,
        },
      });

      const statusChanged = nextStatus !== existing.status;
      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        projectId,
        action: "project_updated",
        metadata: {
          projectName: updated.name,
          changedFields,
          ...(statusChanged
            ? {
                previousStatus: existing.status,
                newStatus: nextStatus,
              }
            : {}),
        },
      });

      await dispatchProjectTerminalNotification(tx, {
        teamId,
        actorId: user.id,
        projectId,
        projectName: updated.name,
        previousStatus: existing.status,
        nextStatus,
      });

      return {
        changed: true as const,
        project: updated,
      };
    });

    if (outcome.changed) {
      revalidatePath(`/teams/${teamId}`);
      revalidatePath(`/teams/${teamId}/projects`);
      revalidatePath(`/teams/${teamId}/projects/${projectId}`);
    }

    return {
      success: true,
      data: {
        projectId: outcome.project.id,
        name: outcome.project.name,
        status: outcome.project.status,
      },
    };
  } catch (error) {
    if (error instanceof ProjectFieldError) {
      return {
        success: false,
        error: error.message,
        fieldErrors: error.fieldErrors,
      };
    }

    console.error("[updateProjectAction] Failed to update project:", error);
    return {
      success: false,
      error: sanitizeProjectActionError(
        error,
        "Failed to update project. Please try again."
      ),
    };
  }
}

/**
 * Transitions a project's status among PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELLED.
 * OWNER or MANAGER only. No-op status changes do not generate ActivityLog entries.
 */
export async function updateProjectStatusAction(
  input: unknown
): Promise<ActionResult<{ projectId: string; status: ProjectStatus }>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = updateProjectStatusSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: formatZodFieldErrors(parseResult.error),
    };
  }

  const { teamId, projectId, status } = parseResult.data;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await lockAndLoadExistingProject(
        tx,
        teamId,
        projectId,
        user.id
      );

      if (existing.status === status) {
        return {
          changed: false as const,
          status: existing.status,
        };
      }

      const updated = await tx.project.update({
        where: {
          id_teamId: {
            id: projectId,
            teamId,
          },
        },
        data: {
          status,
          updatedById: user.id,
        },
      });

      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        projectId,
        action: "project_updated",
        metadata: {
          projectName: existing.name,
          changedFields: ["status"],
          previousStatus: existing.status,
          newStatus: status,
        },
      });

      await dispatchProjectTerminalNotification(tx, {
        teamId,
        actorId: user.id,
        projectId,
        projectName: updated.name,
        previousStatus: existing.status,
        nextStatus: updated.status,
      });

      return {
        changed: true as const,
        status: updated.status,
      };
    });

    if (outcome.changed) {
      revalidatePath(`/teams/${teamId}`);
      revalidatePath(`/teams/${teamId}/projects`);
      revalidatePath(`/teams/${teamId}/projects/${projectId}`);
    }

    return {
      success: true,
      data: {
        projectId,
        status: outcome.status,
      },
    };
  } catch (error) {
    console.error("[updateProjectStatusAction] Failed to update status:", error);
    return {
      success: false,
      error: sanitizeProjectActionError(
        error,
        "Failed to update project status. Please try again."
      ),
    };
  }
}

/**
 * Soft-deletes a project by setting deletedAt inside a locked transaction.
 * OWNER or MANAGER only. Preserves ActivityLog audit trail.
 */
export async function deleteProjectAction(
  input: unknown
): Promise<ActionResult<{ projectId: string }>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = deleteProjectSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: formatZodFieldErrors(parseResult.error),
    };
  }

  const { teamId, projectId } = parseResult.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await lockAndLoadExistingProject(
        tx,
        teamId,
        projectId,
        user.id
      );

      await tx.project.update({
        where: {
          id_teamId: {
            id: projectId,
            teamId,
          },
        },
        data: {
          deletedAt: new Date(),
          updatedById: user.id,
        },
      });

      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        projectId,
        action: "project_deleted",
        metadata: {
          projectName: existing.name,
          previousStatus: existing.status,
        },
      });
    });

    revalidatePath(`/teams/${teamId}`);
    revalidatePath(`/teams/${teamId}/projects`);
    revalidatePath(`/teams/${teamId}/projects/${projectId}`);

    return {
      success: true,
      data: { projectId },
    };
  } catch (error) {
    console.error("[deleteProjectAction] Failed to delete project:", error);
    return {
      success: false,
      error: sanitizeProjectActionError(
        error,
        "Failed to delete project. Please try again."
      ),
    };
  }
}
