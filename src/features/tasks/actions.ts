"use server";

import { revalidatePath } from "next/cache";
import { recordActivityLog, type ActivityWriteEntry } from "@/features/activity/writer";
import { getActionUser } from "@/features/auth/server";
import {
  notifyTaskAssigned,
  notifyTaskStatusChanged,
} from "@/features/notifications/writer";
import {
  areUtcDatesEqual,
  toUtcDateInputValue,
} from "@/features/projects/date-utils";
import type { ActionResult } from "@/features/teams/actions";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createTaskSchema,
  deleteTaskSchema,
  isValidUuid,
  taskFieldErrorsFromZod,
  updateTaskSchema,
  updateTaskStatusSchema,
  type CreateTaskInput,
  type DeleteTaskInput,
  type TaskPriorityValue,
  type TaskStatusValue,
  type UpdateTaskInput,
  type UpdateTaskStatusInput,
} from "./validation";

class TaskActionError extends Error {
  readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "TaskActionError";
    this.fieldErrors = fieldErrors;
  }
}

type TxClient = Prisma.TransactionClient;

interface LockedTaskRow {
  id: string;
  teamId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  dueDate: Date | null;
  assignedToId: string | null;
  deletedAt: Date | null;
}

function uniqueSortedUuids(ids: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0)),
  ).sort();
}

async function lockTeamOrThrow(tx: TxClient, teamId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string; deletedAt: Date | null }>>`
    SELECT id, "deletedAt" FROM "team" WHERE id = ${teamId}::uuid FOR NO KEY UPDATE
  `;
  const team = rows[0];
  if (!team || team.deletedAt !== null) {
    throw new TaskActionError("Team not found.");
  }
}

async function lockProjectsOrThrow(
  tx: TxClient,
  teamId: string,
  projectIds: string[],
): Promise<void> {
  const sortedIds = uniqueSortedUuids(projectIds);
  for (const projectId of sortedIds) {
    const rows = await tx.$queryRaw<Array<{ id: string; deletedAt: Date | null }>>`
      SELECT id, "deletedAt" FROM "project" WHERE id = ${projectId}::uuid AND "teamId" = ${teamId}::uuid FOR NO KEY UPDATE
    `;
    const project = rows[0];
    if (!project || project.deletedAt !== null) {
      throw new TaskActionError("Project not found.");
    }
  }
}

async function lockUsersAndAuthorize(
  tx: TxClient,
  teamId: string,
  callerId: string,
  extraUserIds: Array<string | null | undefined>,
  options: {
    requireManagerOrOwner: boolean;
    assigneeId?: string | null;
  },
): Promise<{
  role: "OWNER" | "MANAGER" | "MEMBER";
  lockedUsers: Map<string, { id: string; deletedAt: Date | null }>;
}> {
  const sortedUserIds = uniqueSortedUuids([callerId, ...extraUserIds]);
  const lockedUsers = new Map<string, { id: string; deletedAt: Date | null }>();

  for (const uid of sortedUserIds) {
    const rows = await tx.$queryRaw<Array<{ id: string; deletedAt: Date | null }>>`
      SELECT id, "deletedAt" FROM "user" WHERE id = ${uid}::uuid FOR NO KEY UPDATE
    `;
    if (rows[0]) {
      lockedUsers.set(uid, rows[0]);
    }
  }

  const caller = lockedUsers.get(callerId);
  if (!caller || caller.deletedAt !== null) {
    throw new TaskActionError("Your account is no longer active.");
  }

  const membership = await tx.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: callerId } },
    select: { role: true },
  });

  if (!membership) {
    throw new TaskActionError("You are not a member of this team.");
  }

  if (
    options.requireManagerOrOwner &&
    membership.role !== "OWNER" &&
    membership.role !== "MANAGER"
  ) {
    throw new TaskActionError("Only team owners and managers can manage tasks.");
  }

  if (options.assigneeId) {
    const assigneeUser = lockedUsers.get(options.assigneeId);
    if (!assigneeUser || assigneeUser.deletedAt !== null) {
      throw new TaskActionError("Assignee must be an active member of this team.");
    }

    const assigneeMembership = await tx.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: options.assigneeId } },
      select: { role: true },
    });

    if (!assigneeMembership) {
      throw new TaskActionError("Assignee must be an active member of this team.");
    }
  }

  return { role: membership.role, lockedUsers };
}

async function isActiveTeamRecipient(
  tx: TxClient,
  teamId: string,
  recipientId: string,
  lockedUsers: Map<string, { id: string; deletedAt: Date | null }>,
): Promise<boolean> {
  if (!recipientId) {
    return false;
  }

  const locked = lockedUsers.get(recipientId);
  if (!locked || locked.deletedAt !== null) {
    return false;
  }

  const membership = await tx.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: recipientId } },
    select: { role: true },
  });

  return Boolean(membership);
}

async function lockAndReadTaskOrThrow(
  tx: TxClient,
  teamId: string,
  taskId: string,
): Promise<LockedTaskRow> {
  const lockRows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "task" WHERE id = ${taskId}::uuid AND "teamId" = ${teamId}::uuid FOR NO KEY UPDATE
  `;

  if (!lockRows[0]) {
    throw new TaskActionError("Task not found.");
  }

  const task = await tx.task.findFirst({
    where: { id: taskId, teamId, deletedAt: null },
    select: {
      id: true,
      teamId: true,
      projectId: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      assignedToId: true,
      deletedAt: true,
    },
  });

  if (!task || task.deletedAt !== null) {
    throw new TaskActionError("Task not found.");
  }

  return task as LockedTaskRow;
}

function revalidateTaskPaths(
  teamId: string,
  projectIds: string[],
  options?: { includeProjectsList?: boolean },
): void {
  revalidatePath(`/teams/${teamId}`);
  revalidatePath(`/teams/${teamId}/tasks`);
  if (options?.includeProjectsList ?? true) {
    revalidatePath(`/teams/${teamId}/projects`);
  }
  for (const projectId of uniqueSortedUuids(projectIds)) {
    revalidatePath(`/teams/${teamId}/projects/${projectId}`);
  }
}

function toTaskFailure<T>(error: unknown): ActionResult<T> {
  if (error instanceof TaskActionError) {
    return {
      success: false,
      error: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };
  }

  console.error("Task server action failed:", error);
  return {
    success: false,
    error: "Unable to complete task action. Please try again.",
  };
}

/**
 * Creates a task inside a team's non-deleted project (OWNER/MANAGER only).
 * Lock order: team -> project -> sorted users.
 */
export async function createTaskAction(
  teamId: string,
  input: CreateTaskInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await getActionUser();
  if (!user) {
    return { success: false, error: "You must be signed in to perform this action." };
  }

  if (!isValidUuid(teamId)) {
    return { success: false, error: "Invalid team ID." };
  }

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the validation errors below.",
      fieldErrors: taskFieldErrorsFromZod(parsed.error),
    };
  }

  const data = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      await lockTeamOrThrow(tx, teamId);
      await lockProjectsOrThrow(tx, teamId, [data.projectId]);
      await lockUsersAndAuthorize(tx, teamId, user.id, [data.assignedToId], {
        requireManagerOrOwner: true,
        assigneeId: data.assignedToId,
      });

      const task = await tx.task.create({
        data: {
          teamId,
          projectId: data.projectId,
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          dueDate: data.dueDate,
          assignedToId: data.assignedToId,
          createdById: user.id,
          updatedById: user.id,
        },
        select: {
          id: true,
          projectId: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assignedToId: true,
        },
      });

      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        projectId: task.projectId,
        taskId: task.id,
        action: "task_created",
        metadata: {
          title: task.title,
          status: task.status,
          priority: task.priority,
          assignedToId: task.assignedToId,
          dueDate: toUtcDateInputValue(task.dueDate) || null,
        },
      });

      if (task.assignedToId) {
        await notifyTaskAssigned(tx, {
          teamId,
          actorId: user.id,
          projectId: task.projectId,
          taskId: task.id,
          recipientUserId: task.assignedToId,
          taskTitle: task.title,
        });
      }

      return task;
    });

    revalidateTaskPaths(teamId, [created.projectId]);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    return toTaskFailure(error);
  }
}

/**
 * Updates task details, project assignment, status, priority, due date, or assignee (OWNER/MANAGER only).
 * Lock order: team -> sorted projects -> sorted users -> task.
 */
export async function updateTaskAction(
  teamId: string,
  input: UpdateTaskInput,
): Promise<ActionResult<{ id: string; noOp?: boolean }>> {
  const user = await getActionUser();
  if (!user) {
    return { success: false, error: "You must be signed in to perform this action." };
  }

  if (!isValidUuid(teamId)) {
    return { success: false, error: "Invalid team ID." };
  }

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the validation errors below.",
      fieldErrors: taskFieldErrorsFromZod(parsed.error),
    };
  }

  const data = parsed.data;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await lockTeamOrThrow(tx, teamId);

      const preTask = await tx.task.findFirst({
        where: { id: data.taskId, teamId, deletedAt: null },
        select: { id: true, projectId: true, assignedToId: true },
      });
      if (!preTask) {
        throw new TaskActionError("Task not found.");
      }

      const projectIdsToLock = [
        preTask.projectId,
        ...(data.projectId && data.projectId !== preTask.projectId
          ? [data.projectId]
          : []),
      ];
      await lockProjectsOrThrow(tx, teamId, projectIdsToLock);

      const { lockedUsers } = await lockUsersAndAuthorize(
        tx,
        teamId,
        user.id,
        [preTask.assignedToId, data.assignedToId],
        {
          requireManagerOrOwner: true,
          assigneeId: data.assignedToId ?? null,
        },
      );

      const existing = await lockAndReadTaskOrThrow(tx, teamId, data.taskId);
      if (existing.projectId !== preTask.projectId) {
        await lockProjectsOrThrow(tx, teamId, [existing.projectId]);
      }

      const changedFields: string[] = [];
      const updateData: Prisma.TaskUncheckedUpdateInput = {};

      if (data.projectId !== undefined && data.projectId !== existing.projectId) {
        changedFields.push("projectId");
        updateData.projectId = data.projectId;
      }
      if (data.title !== undefined && data.title !== existing.title) {
        changedFields.push("title");
        updateData.title = data.title;
      }
      if (
        data.description !== undefined &&
        data.description !== existing.description
      ) {
        changedFields.push("description");
        updateData.description = data.description;
      }
      if (data.status !== undefined && data.status !== existing.status) {
        changedFields.push("status");
        updateData.status = data.status;
      }
      if (data.priority !== undefined && data.priority !== existing.priority) {
        changedFields.push("priority");
        updateData.priority = data.priority;
      }
      if (
        data.dueDate !== undefined &&
        !areUtcDatesEqual(data.dueDate, existing.dueDate)
      ) {
        changedFields.push("dueDate");
        updateData.dueDate = data.dueDate;
      }
      if (
        data.assignedToId !== undefined &&
        data.assignedToId !== existing.assignedToId
      ) {
        changedFields.push("assignedToId");
        updateData.assignedToId = data.assignedToId;
      }

      if (changedFields.length === 0) {
        return {
          id: existing.id,
          noOp: true,
          projectIdsToRevalidate: [] as string[],
        };
      }

      const nextTitle = data.title ?? existing.title;
      const nextProjectId = data.projectId ?? existing.projectId;

      await tx.task.update({
        where: { id: existing.id },
        data: {
          ...updateData,
          updatedById: user.id,
        },
      });

      let entry: ActivityWriteEntry;

      if (changedFields.length === 1 && changedFields[0] === "status") {
        entry = {
          teamId,
          actorId: user.id,
          projectId: nextProjectId,
          taskId: existing.id,
          action: "task_status_changed",
          metadata: {
            title: nextTitle,
            previousStatus: existing.status,
            newStatus: data.status!,
          },
        };
      } else if (
        changedFields.length === 1 &&
        changedFields[0] === "assignedToId" &&
        data.assignedToId !== null &&
        data.assignedToId !== undefined
      ) {
        if (existing.assignedToId === null) {
          entry = {
            teamId,
            actorId: user.id,
            projectId: nextProjectId,
            taskId: existing.id,
            action: "task_assigned",
            metadata: {
              title: nextTitle,
              assigneeId: data.assignedToId,
            },
          };
        } else {
          entry = {
            teamId,
            actorId: user.id,
            projectId: nextProjectId,
            taskId: existing.id,
            action: "task_reassigned",
            metadata: {
              title: nextTitle,
              previousAssigneeId: existing.assignedToId,
              newAssigneeId: data.assignedToId,
            },
          };
        }
      } else {
        const metadata: Extract<ActivityWriteEntry, { action: "task_updated" }>["metadata"] = {
          title: nextTitle,
          changedFields,
        };
        if (changedFields.includes("status") && data.status !== undefined) {
          metadata.previousStatus = existing.status;
          metadata.newStatus = data.status;
        }
        if (changedFields.includes("assignedToId")) {
          metadata.previousAssigneeId = existing.assignedToId;
          metadata.newAssigneeId = data.assignedToId ?? null;
        }
        if (changedFields.includes("projectId") && data.projectId !== undefined) {
          metadata.previousProjectId = existing.projectId;
          metadata.newProjectId = data.projectId;
        }
        entry = {
          teamId,
          actorId: user.id,
          projectId: nextProjectId,
          taskId: existing.id,
          action: "task_updated",
          metadata,
        };
      }

      await recordActivityLog(tx, entry);

      const assigneeChangedToUser =
        data.assignedToId !== undefined &&
        data.assignedToId !== null &&
        data.assignedToId !== existing.assignedToId;
      const statusChanged =
        data.status !== undefined && data.status !== existing.status;

      if (assigneeChangedToUser) {
        await notifyTaskAssigned(tx, {
          teamId,
          actorId: user.id,
          projectId: nextProjectId,
          taskId: existing.id,
          recipientUserId: data.assignedToId,
          taskTitle: nextTitle,
        });
      } else if (statusChanged) {
        const currentAssigneeId =
          data.assignedToId !== undefined
            ? data.assignedToId
            : existing.assignedToId;

        if (
          currentAssigneeId &&
          currentAssigneeId !== user.id &&
          (await isActiveTeamRecipient(
            tx,
            teamId,
            currentAssigneeId,
            lockedUsers,
          ))
        ) {
          await notifyTaskStatusChanged(tx, {
            teamId,
            actorId: user.id,
            projectId: nextProjectId,
            taskId: existing.id,
            recipientUserId: currentAssigneeId,
            taskTitle: nextTitle,
            previousStatus: existing.status,
            newStatus: data.status!,
          });
        }
      }

      return {
        id: existing.id,
        noOp: false,
        projectIdsToRevalidate: [existing.projectId, nextProjectId],
      };
    });

    if (!outcome.noOp) {
      const movedProject =
        outcome.projectIdsToRevalidate.length === 2 &&
        outcome.projectIdsToRevalidate[0] !== outcome.projectIdsToRevalidate[1];
      revalidateTaskPaths(teamId, outcome.projectIdsToRevalidate, {
        includeProjectsList: movedProject,
      });
    }

    return {
      success: true,
      data: { id: outcome.id, noOp: outcome.noOp },
    };
  } catch (error) {
    return toTaskFailure(error);
  }
}

/**
 * Updates a task's workflow status. OWNER/MANAGER may update any task; MEMBER only if assignedToId === caller.
 * Lock order: team -> project -> sorted users -> task.
 */
export async function updateTaskStatusAction(
  teamId: string,
  input: UpdateTaskStatusInput,
): Promise<ActionResult<{ id: string; status: TaskStatusValue; noOp?: boolean }>> {
  const user = await getActionUser();
  if (!user) {
    return { success: false, error: "You must be signed in to perform this action." };
  }

  if (!isValidUuid(teamId)) {
    return { success: false, error: "Invalid team ID." };
  }

  const parsed = updateTaskStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the validation errors below.",
      fieldErrors: taskFieldErrorsFromZod(parsed.error),
    };
  }

  const data = parsed.data;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await lockTeamOrThrow(tx, teamId);

      const preTask = await tx.task.findFirst({
        where: { id: data.taskId, teamId, deletedAt: null },
        select: { id: true, projectId: true, assignedToId: true },
      });
      if (!preTask) {
        throw new TaskActionError("Task not found.");
      }

      await lockProjectsOrThrow(tx, teamId, [preTask.projectId]);
      const { role, lockedUsers } = await lockUsersAndAuthorize(
        tx,
        teamId,
        user.id,
        [preTask.assignedToId],
        { requireManagerOrOwner: false },
      );

      const existing = await lockAndReadTaskOrThrow(tx, teamId, data.taskId);

      if (role === "MEMBER" && existing.assignedToId !== user.id) {
        throw new TaskActionError(
          "Members can only update the status of tasks assigned to them.",
        );
      }

      if (existing.status === data.status) {
        return {
          id: existing.id,
          status: existing.status,
          projectId: existing.projectId,
          noOp: true,
        };
      }

      await tx.task.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          updatedById: user.id,
        },
      });

      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        projectId: existing.projectId,
        taskId: existing.id,
        action: "task_status_changed",
        metadata: {
          title: existing.title,
          previousStatus: existing.status,
          newStatus: data.status,
        },
      });

      if (
        existing.assignedToId &&
        existing.assignedToId !== user.id &&
        (await isActiveTeamRecipient(
          tx,
          teamId,
          existing.assignedToId,
          lockedUsers,
        ))
      ) {
        await notifyTaskStatusChanged(tx, {
          teamId,
          actorId: user.id,
          projectId: existing.projectId,
          taskId: existing.id,
          recipientUserId: existing.assignedToId,
          taskTitle: existing.title,
          previousStatus: existing.status,
          newStatus: data.status,
        });
      }

      return {
        id: existing.id,
        status: data.status,
        projectId: existing.projectId,
        noOp: false,
      };
    });

    if (!outcome.noOp) {
      revalidateTaskPaths(teamId, [outcome.projectId], {
        includeProjectsList: false,
      });
    }

    return {
      success: true,
      data: {
        id: outcome.id,
        status: outcome.status,
        noOp: outcome.noOp,
      },
    };
  } catch (error) {
    return toTaskFailure(error);
  }
}

/**
 * Soft-deletes a task, clears assignedToId, and records previousAssigneeId in ActivityLog (OWNER/MANAGER only).
 * Lock order: team -> project -> sorted users -> task.
 */
export async function deleteTaskAction(
  teamId: string,
  input: DeleteTaskInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await getActionUser();
  if (!user) {
    return { success: false, error: "You must be signed in to perform this action." };
  }

  if (!isValidUuid(teamId)) {
    return { success: false, error: "Invalid team ID." };
  }

  const parsed = deleteTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the validation errors below.",
      fieldErrors: taskFieldErrorsFromZod(parsed.error),
    };
  }

  const data = parsed.data;

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      await lockTeamOrThrow(tx, teamId);

      const preTask = await tx.task.findFirst({
        where: { id: data.taskId, teamId, deletedAt: null },
        select: { id: true, projectId: true, assignedToId: true },
      });
      if (!preTask) {
        throw new TaskActionError("Task not found.");
      }

      await lockProjectsOrThrow(tx, teamId, [preTask.projectId]);
      await lockUsersAndAuthorize(
        tx,
        teamId,
        user.id,
        [preTask.assignedToId],
        { requireManagerOrOwner: true },
      );

      const existing = await lockAndReadTaskOrThrow(tx, teamId, data.taskId);

      await tx.task.update({
        where: { id: existing.id },
        data: {
          deletedAt: new Date(),
          assignedToId: null,
          updatedById: user.id,
        },
      });

      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        projectId: existing.projectId,
        taskId: existing.id,
        action: "task_deleted",
        metadata: {
          title: existing.title,
          previousAssigneeId: existing.assignedToId,
        },
      });

      return { id: existing.id, projectId: existing.projectId };
    });

    revalidateTaskPaths(teamId, [deleted.projectId]);
    return { success: true, data: { id: deleted.id } };
  } catch (error) {
    return toTaskFailure(error);
  }
}
