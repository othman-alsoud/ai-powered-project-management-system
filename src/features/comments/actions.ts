"use server";

import { revalidatePath } from "next/cache";
import { recordActivityLog } from "@/features/activity/writer";
import { getActionUser } from "@/features/auth/server";
import type { ActionResult } from "@/features/teams/actions";
import type { Prisma, TeamRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  commentSummarySelect,
  mapCommentRowToSummary,
  queryActiveTaskComments,
  type CommentItemSummary,
  type CommentThreadResult,
  type RawCommentRow,
} from "./server";
import {
  commentFieldErrorsFromZod,
  createCommentSchema,
  deleteCommentSchema,
  isValidUuid,
  loadTaskCommentsSchema,
  updateCommentSchema,
  type CreateCommentInput,
  type DeleteCommentInput,
  type LoadTaskCommentsInput,
  type UpdateCommentInput,
} from "./validation";

class CommentActionError extends Error {
  readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "CommentActionError";
    this.fieldErrors = fieldErrors;
  }
}

type TxClient = Prisma.TransactionClient;

interface AuthorizedCommentContext {
  role: TeamRole;
  task: {
    id: string;
    teamId: string;
    projectId: string;
    title: string;
  };
}

async function lockAndAuthorizeTaskForComment(
  tx: TxClient,
  teamId: string,
  callerId: string,
  taskId: string,
): Promise<AuthorizedCommentContext> {
  // Lock order: team -> project -> user -> task (matches tasks/actions.ts to prevent deadlocks).
  const teamRows = await tx.$queryRaw<
    Array<{ id: string; deletedAt: Date | null }>
  >`
    SELECT id, "deletedAt" FROM "team" WHERE id = ${teamId}::uuid FOR NO KEY UPDATE
  `;
  const team = teamRows[0];
  if (!team || team.deletedAt !== null) {
    throw new CommentActionError("Team not found.");
  }

  const preTask = await tx.task.findFirst({
    where: { id: taskId, teamId, deletedAt: null },
    select: { id: true, projectId: true },
  });
  if (!preTask) {
    throw new CommentActionError("Task not found.");
  }

  const projectRows = await tx.$queryRaw<
    Array<{ id: string; deletedAt: Date | null }>
  >`
    SELECT id, "deletedAt" FROM "project" WHERE id = ${preTask.projectId}::uuid AND "teamId" = ${teamId}::uuid FOR NO KEY UPDATE
  `;
  const project = projectRows[0];
  if (!project || project.deletedAt !== null) {
    throw new CommentActionError("Project not found.");
  }

  const userRows = await tx.$queryRaw<
    Array<{ id: string; deletedAt: Date | null }>
  >`
    SELECT id, "deletedAt" FROM "user" WHERE id = ${callerId}::uuid FOR NO KEY UPDATE
  `;
  const caller = userRows[0];
  if (!caller || caller.deletedAt !== null) {
    throw new CommentActionError("Your account is no longer active.");
  }

  const membership = await tx.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: callerId } },
    select: { role: true },
  });
  if (!membership) {
    throw new CommentActionError("You are not a member of this team.");
  }

  const taskLockRows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "task" WHERE id = ${taskId}::uuid AND "teamId" = ${teamId}::uuid FOR NO KEY UPDATE
  `;
  if (!taskLockRows[0]) {
    throw new CommentActionError("Task not found.");
  }

  const task = await tx.task.findFirst({
    where: { id: taskId, teamId, deletedAt: null },
    select: {
      id: true,
      teamId: true,
      projectId: true,
      title: true,
      deletedAt: true,
    },
  });
  if (!task || task.deletedAt !== null) {
    throw new CommentActionError("Task not found.");
  }

  if (task.projectId !== preTask.projectId) {
    const currentProjectRows = await tx.$queryRaw<
      Array<{ id: string; deletedAt: Date | null }>
    >`
      SELECT id, "deletedAt" FROM "project" WHERE id = ${task.projectId}::uuid AND "teamId" = ${teamId}::uuid FOR NO KEY UPDATE
    `;
    const currentProject = currentProjectRows[0];
    if (!currentProject || currentProject.deletedAt !== null) {
      throw new CommentActionError("Project not found.");
    }
  }

  return {
    role: membership.role,
    task: {
      id: task.id,
      teamId: task.teamId,
      projectId: task.projectId,
      title: task.title,
    },
  };
}

async function lockAndReadCommentOrThrow(
  tx: TxClient,
  teamId: string,
  taskId: string,
  commentId: string,
): Promise<RawCommentRow & { deletedAt: Date | null }> {
  const lockRows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "comment" WHERE id = ${commentId}::uuid AND "teamId" = ${teamId}::uuid FOR NO KEY UPDATE
  `;
  if (!lockRows[0]) {
    throw new CommentActionError("Comment not found.");
  }

  const comment = await tx.comment.findFirst({
    where: {
      id: commentId,
      teamId,
      taskId,
      deletedAt: null,
    },
    select: {
      ...commentSummarySelect,
      deletedAt: true,
    },
  });

  if (!comment || comment.deletedAt !== null) {
    throw new CommentActionError("Comment not found.");
  }

  return comment as RawCommentRow & { deletedAt: Date | null };
}

function revalidateCommentPaths(teamId: string, projectId: string): void {
  revalidatePath(`/teams/${teamId}`);
  revalidatePath(`/teams/${teamId}/tasks`);
  revalidatePath(`/teams/${teamId}/projects/${projectId}`);
}

function toCommentFailure<T>(error: unknown): ActionResult<T> {
  if (error instanceof CommentActionError) {
    return {
      success: false,
      error: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };
  }

  console.error("Comment server action failed:", error);
  return {
    success: false,
    error: "Unable to complete comment action. Please try again.",
  };
}

/**
 * Dedicated read-only Server Action for loading task comments on dialog open or refresh.
 * Independently verifies authentication, active user, active team, team membership,
 * and active task/project state before returning serializable comments.
 */
export async function getTaskCommentsAction(
  teamId: string,
  input: LoadTaskCommentsInput,
): Promise<ActionResult<CommentThreadResult>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "You must be signed in to view comments.",
    };
  }

  if (!isValidUuid(teamId)) {
    return { success: false, error: "Invalid team ID." };
  }

  const parsed = loadTaskCommentsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid task ID.",
      fieldErrors: commentFieldErrorsFromZod(parsed.error),
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
      return { success: false, error: "Your account is no longer active." };
    }
    if (!activeTeam) {
      return { success: false, error: "Team not found." };
    }
    if (!membership) {
      return { success: false, error: "You are not a member of this team." };
    }

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
      return { success: false, error: "Task not found." };
    }

    const thread = await queryActiveTaskComments(teamId, activeTask.id);
    return { success: true, data: thread };
  } catch (error) {
    console.error("Failed to load task comments:", error);
    return {
      success: false,
      error: "Unable to load comments right now. Please try again.",
    };
  }
}

/**
 * Posts a comment on an active task inside the caller's team (OWNER, MANAGER, MEMBER).
 * Records a non-sensitive comment_created ActivityLog entry (no comment text).
 */
export async function createCommentAction(
  teamId: string,
  input: CreateCommentInput,
): Promise<ActionResult<CommentItemSummary>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "You must be signed in to perform this action.",
    };
  }

  if (!isValidUuid(teamId)) {
    return { success: false, error: "Invalid team ID." };
  }

  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the validation errors below.",
      fieldErrors: commentFieldErrorsFromZod(parsed.error),
    };
  }

  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const { task } = await lockAndAuthorizeTaskForComment(
        tx,
        teamId,
        user.id,
        data.taskId,
      );

      const created = await tx.comment.create({
        data: {
          teamId,
          taskId: task.id,
          userId: user.id,
          content: data.content,
        },
        select: commentSummarySelect,
      });

      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        projectId: task.projectId,
        taskId: task.id,
        commentId: created.id,
        action: "comment_created",
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
          commentId: created.id,
        },
      });

      return {
        projectId: task.projectId,
        comment: mapCommentRowToSummary(created),
      };
    });

    revalidateCommentPaths(teamId, result.projectId);
    return { success: true, data: result.comment };
  } catch (error) {
    return toCommentFailure(error);
  }
}

/**
 * Edits the caller's own comment (strict author-only check; no role overrides).
 * Records a non-sensitive comment_updated ActivityLog entry (no comment text).
 */
export async function updateCommentAction(
  teamId: string,
  input: UpdateCommentInput,
): Promise<ActionResult<{ comment: CommentItemSummary; noOp?: boolean }>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "You must be signed in to perform this action.",
    };
  }

  if (!isValidUuid(teamId)) {
    return { success: false, error: "Invalid team ID." };
  }

  const parsed = updateCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the validation errors below.",
      fieldErrors: commentFieldErrorsFromZod(parsed.error),
    };
  }

  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const { task } = await lockAndAuthorizeTaskForComment(
        tx,
        teamId,
        user.id,
        data.taskId,
      );

      const existing = await lockAndReadCommentOrThrow(
        tx,
        teamId,
        task.id,
        data.commentId,
      );

      if (existing.userId !== user.id) {
        throw new CommentActionError("You can only edit your own comments.");
      }

      if (existing.content === data.content) {
        return {
          noOp: true,
          projectId: task.projectId,
          comment: mapCommentRowToSummary(existing),
        };
      }

      const updated = await tx.comment.update({
        where: { id: existing.id },
        data: { content: data.content },
        select: commentSummarySelect,
      });

      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        projectId: task.projectId,
        taskId: task.id,
        commentId: existing.id,
        action: "comment_updated",
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
          commentId: existing.id,
        },
      });

      return {
        noOp: false,
        projectId: task.projectId,
        comment: mapCommentRowToSummary(updated),
      };
    });

    if (!result.noOp) {
      revalidateCommentPaths(teamId, result.projectId);
    }

    return {
      success: true,
      data: {
        comment: result.comment,
        noOp: result.noOp,
      },
    };
  } catch (error) {
    return toCommentFailure(error);
  }
}

/**
 * Soft-deletes a comment. Authors may delete their own comments; OWNER and MANAGER may
 * delete any comment for moderation. Records a non-sensitive comment_deleted ActivityLog entry.
 */
export async function deleteCommentAction(
  teamId: string,
  input: DeleteCommentInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "You must be signed in to perform this action.",
    };
  }

  if (!isValidUuid(teamId)) {
    return { success: false, error: "Invalid team ID." };
  }

  const parsed = deleteCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the validation errors below.",
      fieldErrors: commentFieldErrorsFromZod(parsed.error),
    };
  }

  const data = parsed.data;

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const { role, task } = await lockAndAuthorizeTaskForComment(
        tx,
        teamId,
        user.id,
        data.taskId,
      );

      const existing = await lockAndReadCommentOrThrow(
        tx,
        teamId,
        task.id,
        data.commentId,
      );

      const isAuthor = existing.userId === user.id;
      const canModerate = role === "OWNER" || role === "MANAGER";

      if (!isAuthor && !canModerate) {
        throw new CommentActionError(
          "Only the comment author, team owners, or managers can delete comments.",
        );
      }

      await tx.comment.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });

      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        projectId: task.projectId,
        taskId: task.id,
        commentId: existing.id,
        action: "comment_deleted",
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
          commentId: existing.id,
          deletedByRole: role,
          isSelfDelete: isAuthor,
        },
      });

      return { id: existing.id, projectId: task.projectId };
    });

    revalidateCommentPaths(teamId, deleted.projectId);
    return { success: true, data: { id: deleted.id } };
  } catch (error) {
    return toCommentFailure(error);
  }
}
