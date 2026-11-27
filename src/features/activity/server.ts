import { notFound } from "next/navigation";
import type {
  Prisma,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  TeamRole,
} from "@/generated/prisma/client";
import { requireAuthPage } from "@/features/auth/server";
import { requireTeamMember } from "@/features/teams/server";
import { prisma } from "@/lib/prisma";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_FEED_DEFAULT_LIMIT,
  ACTIVITY_FEED_MAX_LIMIT,
  DELETED_USER_DISPLAY_NAME,
} from "./constants";
import type {
  ActivityAction,
  ActivityActorSummary,
  ActivityCursor,
  ActivityDetailsDTO,
  ActivityEntityRef,
  ActivityFeedPage,
  ActivityFeedQueryOptions,
  ActivityLogItemDTO,
  ActivityTargetUserSummary,
} from "./types";
import {
  decodeActivityCursor,
  encodeActivityCursor,
  isValidUuid,
  type ActivityFeedQueryInput,
} from "./validation";

const TEAM_ROLES = new Set<string>(["OWNER", "MANAGER", "MEMBER"]);
const PROJECT_STATUSES = new Set<string>([
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]);
const TASK_STATUSES = new Set<string>([
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
]);
const TASK_PRIORITIES = new Set<string>(["LOW", "MEDIUM", "HIGH"]);
const ACTIVITY_ACTION_SET = new Set<string>(ACTIVITY_ACTIONS);

const TARGET_USER_METADATA_KEYS = [
  "addedUserId",
  "targetUserId",
  "removedUserId",
  "previousOwnerId",
  "newOwnerId",
  "assignedToId",
  "assigneeId",
  "previousAssigneeId",
  "newAssigneeId",
] as const;

export const activityLogSelect = {
  id: true,
  teamId: true,
  actorId: true,
  projectId: true,
  taskId: true,
  commentId: true,
  action: true,
  metadata: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      name: true,
      image: true,
      deletedAt: true,
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      deletedAt: true,
    },
  },
  task: {
    select: {
      id: true,
      title: true,
      deletedAt: true,
    },
  },
} as const;

export interface RawActivityLogRow {
  id: string;
  teamId: string;
  actorId: string | null;
  projectId: string | null;
  taskId: string | null;
  commentId: string | null;
  action: string;
  metadata: unknown;
  createdAt: Date;
  actor: {
    id: string;
    name: string;
    image: string | null;
    deletedAt: Date | null;
  } | null;
  project: {
    id: string;
    name: string;
    deletedAt: Date | null;
  } | null;
  task: {
    id: string;
    title: string;
    deletedAt: Date | null;
  } | null;
}

interface ResolvedUserRecord {
  id: string;
  name: string;
  deletedAt: Date | null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter((v): v is string => typeof v === "string");
  return filtered.length > 0 ? filtered : undefined;
}

function asTeamRole(value: unknown): TeamRole | undefined {
  return typeof value === "string" && TEAM_ROLES.has(value)
    ? (value as TeamRole)
    : undefined;
}

function asProjectStatus(value: unknown): ProjectStatus | undefined {
  return typeof value === "string" && PROJECT_STATUSES.has(value)
    ? (value as ProjectStatus)
    : undefined;
}

function asTaskStatus(value: unknown): TaskStatus | undefined {
  return typeof value === "string" && TASK_STATUSES.has(value)
    ? (value as TaskStatus)
    : undefined;
}

function asTaskPriority(value: unknown): TaskPriority | undefined {
  return typeof value === "string" && TASK_PRIORITIES.has(value)
    ? (value as TaskPriority)
    : undefined;
}

function formatActivityActor(
  actorId: string | null,
  actor: RawActivityLogRow["actor"],
): ActivityActorSummary {
  if (!actorId || !actor || actor.deletedAt !== null) {
    return {
      id: null,
      name: DELETED_USER_DISPLAY_NAME,
      image: null,
      isDeleted: true,
    };
  }

  return {
    id: actor.id,
    name: actor.name,
    image: actor.image,
    isDeleted: false,
  };
}

function resolveTargetUser(
  rawUserId: unknown,
  usersById: ReadonlyMap<string, ResolvedUserRecord>,
): ActivityTargetUserSummary | undefined {
  if (typeof rawUserId !== "string" || !isValidUuid(rawUserId)) {
    return undefined;
  }

  const user = usersById.get(rawUserId);
  if (!user || user.deletedAt !== null) {
    return {
      id: null,
      name: DELETED_USER_DISPLAY_NAME,
      isDeleted: true,
    };
  }

  return {
    id: user.id,
    name: user.name,
    isDeleted: false,
  };
}

function resolveNullableTargetUser(
  rawUserId: unknown,
  usersById: ReadonlyMap<string, ResolvedUserRecord>,
): ActivityTargetUserSummary | null | undefined {
  if (rawUserId === null) {
    return null;
  }
  return resolveTargetUser(rawUserId, usersById);
}

function extractActivityDetails(
  action: ActivityAction,
  rawMetadata: unknown,
  usersById: ReadonlyMap<string, ResolvedUserRecord>,
): ActivityDetailsDTO {
  if (!isPlainRecord(rawMetadata)) {
    return {};
  }

  switch (action) {
    case "team_created":
      return {
        ...(asString(rawMetadata.teamName)
          ? { teamName: asString(rawMetadata.teamName) }
          : {}),
      };

    case "member_added": {
      const targetUser = resolveTargetUser(rawMetadata.addedUserId, usersById);
      const role = asTeamRole(rawMetadata.role);
      return {
        ...(targetUser ? { targetUser } : {}),
        ...(role ? { role } : {}),
      };
    }

    case "member_role_updated": {
      const targetUser = resolveTargetUser(rawMetadata.targetUserId, usersById);
      const previousRole = asTeamRole(rawMetadata.previousRole);
      const newRole = asTeamRole(rawMetadata.newRole);
      return {
        ...(targetUser ? { targetUser } : {}),
        ...(previousRole ? { previousRole } : {}),
        ...(newRole ? { newRole } : {}),
      };
    }

    case "member_removed": {
      const targetUser = resolveTargetUser(rawMetadata.removedUserId, usersById);
      return {
        ...(targetUser ? { targetUser } : {}),
      };
    }

    case "ownership_transferred": {
      const previousOwner = resolveTargetUser(
        rawMetadata.previousOwnerId,
        usersById,
      );
      const newOwner = resolveTargetUser(rawMetadata.newOwnerId, usersById);
      return {
        ...(previousOwner ? { previousOwner } : {}),
        ...(newOwner ? { newOwner } : {}),
      };
    }

    case "member_departed": {
      const reason = asString(rawMetadata.reason);
      const previousRole = asTeamRole(rawMetadata.previousRole);
      return {
        ...(reason ? { reason } : {}),
        ...(previousRole ? { previousRole } : {}),
      };
    }

    case "project_created": {
      const projectName = asString(rawMetadata.projectName);
      const projectStatus = asProjectStatus(rawMetadata.status);
      const startDate = asNullableString(rawMetadata.startDate);
      const endDate = asNullableString(rawMetadata.endDate);
      return {
        ...(projectName ? { projectName } : {}),
        ...(projectStatus ? { projectStatus } : {}),
        ...(startDate !== undefined ? { startDate } : {}),
        ...(endDate !== undefined ? { endDate } : {}),
      };
    }

    case "project_updated": {
      const projectName = asString(rawMetadata.projectName);
      const changedFields = asStringArray(rawMetadata.changedFields);
      const previousProjectStatus = asProjectStatus(rawMetadata.previousStatus);
      const newProjectStatus = asProjectStatus(rawMetadata.newStatus);
      return {
        ...(projectName ? { projectName } : {}),
        ...(changedFields ? { changedFields } : {}),
        ...(previousProjectStatus ? { previousProjectStatus } : {}),
        ...(newProjectStatus ? { newProjectStatus } : {}),
      };
    }

    case "project_deleted": {
      const projectName = asString(rawMetadata.projectName);
      const previousProjectStatus = asProjectStatus(rawMetadata.previousStatus);
      return {
        ...(projectName ? { projectName } : {}),
        ...(previousProjectStatus ? { previousProjectStatus } : {}),
      };
    }

    case "task_created": {
      const taskTitle = asString(rawMetadata.title);
      const taskStatus = asTaskStatus(rawMetadata.status);
      const taskPriority = asTaskPriority(rawMetadata.priority);
      const assignee = resolveNullableTargetUser(
        rawMetadata.assignedToId,
        usersById,
      );
      const dueDate = asNullableString(rawMetadata.dueDate);
      return {
        ...(taskTitle ? { taskTitle } : {}),
        ...(taskStatus ? { taskStatus } : {}),
        ...(taskPriority ? { taskPriority } : {}),
        ...(assignee !== undefined ? { assignee } : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
      };
    }

    case "task_updated": {
      const taskTitle = asString(rawMetadata.title);
      const changedFields = asStringArray(rawMetadata.changedFields);
      const previousTaskStatus = asTaskStatus(rawMetadata.previousStatus);
      const newTaskStatus = asTaskStatus(rawMetadata.newStatus);
      const previousAssignee = resolveNullableTargetUser(
        rawMetadata.previousAssigneeId,
        usersById,
      );
      const newAssignee = resolveNullableTargetUser(
        rawMetadata.newAssigneeId,
        usersById,
      );
      const previousProjectId = asString(rawMetadata.previousProjectId);
      const newProjectId = asString(rawMetadata.newProjectId);
      return {
        ...(taskTitle ? { taskTitle } : {}),
        ...(changedFields ? { changedFields } : {}),
        ...(previousTaskStatus ? { previousTaskStatus } : {}),
        ...(newTaskStatus ? { newTaskStatus } : {}),
        ...(previousAssignee !== undefined ? { previousAssignee } : {}),
        ...(newAssignee !== undefined ? { newAssignee } : {}),
        ...(previousProjectId ? { previousProjectId } : {}),
        ...(newProjectId ? { newProjectId } : {}),
      };
    }

    case "task_status_changed": {
      const taskTitle = asString(rawMetadata.title);
      const previousTaskStatus = asTaskStatus(rawMetadata.previousStatus);
      const newTaskStatus = asTaskStatus(rawMetadata.newStatus);
      return {
        ...(taskTitle ? { taskTitle } : {}),
        ...(previousTaskStatus ? { previousTaskStatus } : {}),
        ...(newTaskStatus ? { newTaskStatus } : {}),
      };
    }

    case "task_assigned": {
      const taskTitle = asString(rawMetadata.title);
      const assignee = resolveTargetUser(rawMetadata.assigneeId, usersById);
      return {
        ...(taskTitle ? { taskTitle } : {}),
        ...(assignee ? { assignee } : {}),
      };
    }

    case "task_reassigned": {
      const taskTitle = asString(rawMetadata.title);
      const previousAssignee = resolveTargetUser(
        rawMetadata.previousAssigneeId,
        usersById,
      );
      const newAssignee = resolveTargetUser(rawMetadata.newAssigneeId, usersById);
      return {
        ...(taskTitle ? { taskTitle } : {}),
        ...(previousAssignee ? { previousAssignee } : {}),
        ...(newAssignee ? { newAssignee } : {}),
      };
    }

    case "task_deleted": {
      const taskTitle = asString(rawMetadata.title);
      const previousAssignee = resolveNullableTargetUser(
        rawMetadata.previousAssigneeId,
        usersById,
      );
      return {
        ...(taskTitle ? { taskTitle } : {}),
        ...(previousAssignee !== undefined ? { previousAssignee } : {}),
      };
    }

    case "comment_created":
    case "comment_updated": {
      const taskTitle = asString(rawMetadata.taskTitle);
      return {
        ...(taskTitle ? { taskTitle } : {}),
      };
    }

    case "comment_deleted": {
      const taskTitle = asString(rawMetadata.taskTitle);
      const deletedByRole = asTeamRole(rawMetadata.deletedByRole);
      const isSelfDelete =
        typeof rawMetadata.isSelfDelete === "boolean"
          ? rawMetadata.isSelfDelete
          : undefined;
      return {
        ...(taskTitle ? { taskTitle } : {}),
        ...(deletedByRole ? { deletedByRole } : {}),
        ...(isSelfDelete !== undefined ? { isSelfDelete } : {}),
      };
    }
  }
}

function collectTargetUserIds(rows: RawActivityLogRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!isPlainRecord(row.metadata)) continue;
    for (const key of TARGET_USER_METADATA_KEYS) {
      const val = row.metadata[key];
      if (typeof val === "string" && isValidUuid(val)) {
        ids.add(val);
      }
    }
  }
  return Array.from(ids);
}

/**
 * Builds the team-scoped Prisma WhereInput enforcing active-team isolation and
 * approved soft-delete visibility rules:
 * - Hides all activity on soft-deleted projects (including project_deleted).
 * - Keeps task_deleted visible when its parent project is active.
 * - Keeps comment_deleted visible when its parent task and project are active.
 * - Hides all other activity on soft-deleted tasks or comments.
 */
export function buildActivityWhereInput(
  teamId: string,
  options?: Omit<ActivityFeedQueryOptions, "limit">,
): Prisma.ActivityLogWhereInput {
  const andClauses: Prisma.ActivityLogWhereInput[] = [
    {
      OR: [{ projectId: null }, { project: { deletedAt: null } }],
    },
    {
      OR: [
        { taskId: null },
        { task: { deletedAt: null } },
        { action: "task_deleted" },
      ],
    },
    {
      OR: [
        { commentId: null },
        { comment: { deletedAt: null }, task: { deletedAt: null } },
        { action: "comment_deleted", task: { deletedAt: null } },
      ],
    },
  ];

  if (options?.projectId) {
    andClauses.push({ projectId: options.projectId });
  }

  if (options?.taskId) {
    andClauses.push({ taskId: options.taskId });
  }

  if (options?.action) {
    andClauses.push({ action: options.action });
  }

  if (options?.cursor) {
    andClauses.push({
      OR: [
        { createdAt: { lt: options.cursor.createdAt } },
        {
          createdAt: options.cursor.createdAt,
          id: { lt: options.cursor.id },
        },
      ],
    });
  }

  return {
    teamId,
    team: { deletedAt: null },
    AND: andClauses,
  };
}

export function mapActivityRowToDTO(
  row: RawActivityLogRow,
  usersById: ReadonlyMap<string, ResolvedUserRecord>,
): ActivityLogItemDTO | null {
  if (!ACTIVITY_ACTION_SET.has(row.action)) {
    return null;
  }

  const action = row.action as ActivityAction;

  const project: ActivityEntityRef | null = row.project
    ? {
        id: row.project.id,
        label: row.project.name,
        isDeleted: row.project.deletedAt !== null,
      }
    : null;

  const task: ActivityEntityRef | null = row.task
    ? {
        id: row.task.id,
        label: row.task.title,
        isDeleted: row.task.deletedAt !== null,
      }
    : null;

  return {
    id: row.id,
    teamId: row.teamId,
    action,
    createdAt: row.createdAt.toISOString(),
    actor: formatActivityActor(row.actorId, row.actor),
    project,
    task,
    commentId: row.commentId,
    details: extractActivityDetails(action, row.metadata, usersById),
  };
}

/**
 * Core team-scoped ActivityLog query returning deterministically ordered,
 * cursor-paginated, anonymized DTOs. Callers must authorize team access first.
 */
export async function queryTeamActivityFeed(
  teamId: string,
  options: ActivityFeedQueryOptions,
): Promise<ActivityFeedPage> {
  const rows = (await prisma.activityLog.findMany({
    where: buildActivityWhereInput(teamId, options),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit + 1,
    select: activityLogSelect,
  })) as unknown as RawActivityLogRow[];

  const hasMore = rows.length > options.limit;
  const pageRows = rows.slice(0, options.limit);

  const targetUserIds = collectTargetUserIds(pageRows);
  const usersById = new Map<string, ResolvedUserRecord>();

  if (targetUserIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: targetUserIds } },
      select: {
        id: true,
        name: true,
        deletedAt: true,
      },
    });
    for (const user of users) {
      usersById.set(user.id, user);
    }
  }

  const items: ActivityLogItemDTO[] = [];
  for (const row of pageRows) {
    const dto = mapActivityRowToDTO(row, usersById);
    if (dto) {
      items.push(dto);
    }
  }

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeActivityCursor({
          createdAt: lastRow.createdAt,
          id: lastRow.id,
        })
      : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}

function isDecodedCursor(value: unknown): value is ActivityCursor {
  return (
    typeof value === "object" &&
    value !== null &&
    "createdAt" in value &&
    "id" in value &&
    value.createdAt instanceof Date &&
    !Number.isNaN(value.createdAt.getTime()) &&
    typeof value.id === "string" &&
    isValidUuid(value.id)
  );
}

function normalizeServerQueryOptions(
  rawParams?: ActivityFeedQueryInput | ActivityFeedQueryOptions,
): ActivityFeedQueryOptions {
  if (!rawParams) {
    return { limit: ACTIVITY_FEED_DEFAULT_LIMIT };
  }

  const rawLimit = rawParams.limit;
  const limit =
    typeof rawLimit === "number" &&
    Number.isInteger(rawLimit) &&
    rawLimit >= 1 &&
    rawLimit <= ACTIVITY_FEED_MAX_LIMIT
      ? rawLimit
      : ACTIVITY_FEED_DEFAULT_LIMIT;

  let cursor: ActivityCursor | undefined;
  if (typeof rawParams.cursor === "string") {
    cursor = decodeActivityCursor(rawParams.cursor) ?? undefined;
  } else if (isDecodedCursor(rawParams.cursor)) {
    cursor = rawParams.cursor;
  }

  const projectId =
    typeof rawParams.projectId === "string" && isValidUuid(rawParams.projectId)
      ? rawParams.projectId.trim()
      : undefined;

  const taskId =
    typeof rawParams.taskId === "string" && isValidUuid(rawParams.taskId)
      ? rawParams.taskId.trim()
      : undefined;

  const action =
    typeof rawParams.action === "string" &&
    ACTIVITY_ACTION_SET.has(rawParams.action)
      ? (rawParams.action as ActivityAction)
      : undefined;

  return {
    limit,
    cursor,
    projectId,
    taskId,
    action,
  };
}

/**
 * Server Component query helper for team-wide activity feed.
 * Enforces authentication before validating teamId and verifies active team membership.
 */
export async function getTeamActivity(
  teamId: string,
  rawParams?: ActivityFeedQueryInput | ActivityFeedQueryOptions,
): Promise<ActivityFeedPage> {
  if (!isValidUuid(teamId)) {
    await requireAuthPage();
    notFound();
  }

  await requireTeamMember(teamId);
  return queryTeamActivityFeed(teamId, normalizeServerQueryOptions(rawParams));
}

/**
 * Server Component query helper for project-scoped activity feed.
 * Always verifies authentication and team membership before validating projectId.
 * Returns null if the project is invalid, cross-team, or soft-deleted.
 */
export async function getProjectActivity(
  teamId: string,
  projectId: string,
  rawParams?:
    | Omit<ActivityFeedQueryInput, "projectId">
    | Omit<ActivityFeedQueryOptions, "projectId">,
): Promise<ActivityFeedPage | null> {
  if (!isValidUuid(teamId)) {
    await requireAuthPage();
    notFound();
  }

  await requireTeamMember(teamId);

  if (!isValidUuid(projectId)) {
    return null;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      teamId,
      deletedAt: null,
      team: { deletedAt: null },
    },
    select: { id: true },
  });

  if (!project) {
    return null;
  }

  const options = normalizeServerQueryOptions(rawParams);
  return queryTeamActivityFeed(teamId, {
    ...options,
    projectId: project.id,
  });
}

/**
 * Server Component query helper for task-scoped activity feed.
 * Always verifies authentication and team membership before validating taskId.
 * Returns null if the task or its parent project is invalid, cross-team, or soft-deleted.
 */
export async function getTaskActivity(
  teamId: string,
  taskId: string,
  rawParams?:
    | Omit<ActivityFeedQueryInput, "taskId">
    | Omit<ActivityFeedQueryOptions, "taskId">,
): Promise<ActivityFeedPage | null> {
  if (!isValidUuid(teamId)) {
    await requireAuthPage();
    notFound();
  }

  await requireTeamMember(teamId);

  if (!isValidUuid(taskId)) {
    return null;
  }

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

  const options = normalizeServerQueryOptions(rawParams);
  return queryTeamActivityFeed(teamId, {
    ...options,
    taskId: task.id,
  });
}
