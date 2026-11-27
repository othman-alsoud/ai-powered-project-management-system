import { requireTeamMember } from "@/features/teams/server";
import { prisma } from "@/lib/prisma";
import { COMMENT_THREAD_LIMIT, isValidUuid } from "./validation";

export interface CommentAuthorSummary {
  id: string | null;
  name: string;
}

export interface CommentItemSummary {
  id: string;
  teamId: string;
  taskId: string;
  userId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  author: CommentAuthorSummary;
}

export interface CommentThreadResult {
  comments: CommentItemSummary[];
  totalCount: number;
  isCapped: boolean;
  limit: number;
}

export interface RawCommentRow {
  id: string;
  teamId: string;
  taskId: string;
  userId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    deletedAt: Date | null;
  } | null;
}

export const commentSummarySelect = {
  id: true,
  teamId: true,
  taskId: true,
  userId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      deletedAt: true,
    },
  },
} as const;

export function mapCommentRowToSummary(row: RawCommentRow): CommentItemSummary {
  const isDeletedAuthor =
    !row.userId || !row.user || row.user.deletedAt !== null;
  const authorName = isDeletedAuthor ? "Deleted User" : row.user!.name;

  return {
    id: row.id,
    teamId: row.teamId,
    taskId: row.taskId,
    userId: row.userId,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isEdited: row.updatedAt.getTime() > row.createdAt.getTime(),
    author: {
      id: isDeletedAuthor ? null : row.user!.id,
      name: authorName,
    },
  };
}

/**
 * Queries active chronological comments for an active task inside an active project/team,
 * strictly enforcing the 200-comment cap and serializable output shape.
 */
export async function queryActiveTaskComments(
  teamId: string,
  taskId: string,
): Promise<CommentThreadResult> {
  const where = {
    teamId,
    taskId,
    deletedAt: null,
    task: {
      deletedAt: null,
      team: { deletedAt: null },
      project: { deletedAt: null },
    },
  };

  const [rows, totalCount] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: COMMENT_THREAD_LIMIT,
      select: commentSummarySelect,
    }),
    prisma.comment.count({ where }),
  ]);

  // Reverse the newest-first slice so the UI renders chronological ascending order.
  const chronologicalRows = [...rows].reverse();

  return {
    comments: chronologicalRows.map((row) => mapCommentRowToSummary(row)),
    totalCount,
    isCapped: totalCount > COMMENT_THREAD_LIMIT,
    limit: COMMENT_THREAD_LIMIT,
  };
}

/**
 * Server Component query helper returning active comments for a task inside the authorized team.
 */
export async function getTaskComments(
  teamId: string,
  taskId: string,
): Promise<CommentThreadResult | null> {
  if (!isValidUuid(teamId) || !isValidUuid(taskId)) {
    return null;
  }

  await requireTeamMember(teamId);

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      teamId,
      deletedAt: null,
      team: { deletedAt: null },
      project: { deletedAt: null },
    },
    select: { id: true },
  });

  if (!task) {
    return null;
  }

  return queryActiveTaskComments(teamId, taskId);
}
