import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DELETED_PROJECT_NOTIFICATION_MESSAGE,
  DELETED_TASK_NOTIFICATION_MESSAGE,
  DELETED_USER_DISPLAY_NAME,
  REVOKED_TEAM_NOTIFICATION_MESSAGE,
  UNAVAILABLE_NOTIFICATION_TITLE,
} from "./constants";
import type {
  NotificationActorDTO,
  NotificationItemDTO,
  NotificationsPageDTO,
  OpenNotificationResult,
} from "./types";
import {
  encodeNotificationCursor,
  type NotificationsQueryParsed,
} from "./validation";

const TASK_NOTIFICATION_TYPES = new Set<string>([
  "task_assigned",
  "task_status_changed",
]);

export const notificationSelect = {
  id: true,
  userId: true,
  actorId: true,
  teamId: true,
  projectId: true,
  taskId: true,
  type: true,
  title: true,
  message: true,
  readAt: true,
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
      projectId: true,
      deletedAt: true,
      project: {
        select: {
          id: true,
          deletedAt: true,
        },
      },
    },
  },
} as const;

export interface RawNotificationRow {
  id: string;
  userId: string;
  actorId: string | null;
  teamId: string | null;
  projectId: string | null;
  taskId: string | null;
  type: string;
  title: string;
  message: string | null;
  readAt: Date | null;
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
    projectId: string;
    deletedAt: Date | null;
    project: {
      id: string;
      deletedAt: Date | null;
    } | null;
  } | null;
}

interface ActiveTeamInfo {
  id: string;
  name: string;
}

export function buildNotificationsWhereInput(
  userId: string,
  options: NotificationsQueryParsed,
): Prisma.NotificationWhereInput {
  const where: Prisma.NotificationWhereInput = {
    userId,
  };

  if (options.filter === "unread") {
    where.readAt = null;
  }

  if (options.cursor) {
    where.OR = [
      { createdAt: { lt: options.cursor.createdAt } },
      {
        createdAt: options.cursor.createdAt,
        id: { lt: options.cursor.id },
      },
    ];
  }

  return where;
}

function resolveNotificationActor(
  actor: RawNotificationRow["actor"],
): NotificationActorDTO {
  if (!actor || actor.deletedAt !== null) {
    return {
      name: DELETED_USER_DISPLAY_NAME,
      image: null,
      isDeleted: true,
    };
  }

  return {
    name: actor.name.trim() || DELETED_USER_DISPLAY_NAME,
    image: actor.image ?? null,
    isDeleted: false,
  };
}

function buildUnavailableDTO(
  row: RawNotificationRow,
  team: ActiveTeamInfo | null,
  actor: NotificationActorDTO,
  message: string,
): NotificationItemDTO {
  return {
    id: row.id,
    type: row.type,
    title: UNAVAILABLE_NOTIFICATION_TITLE,
    message,
    isRead: row.readAt !== null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    actor,
    team,
    href: null,
    isAccessible: false,
  };
}

export function toNotificationDTO(
  row: RawNotificationRow,
  activeTeamsMap: Map<string, ActiveTeamInfo>,
): NotificationItemDTO {
  const activeTeam = row.teamId ? activeTeamsMap.get(row.teamId) : undefined;

  // Never leak workspace/entity names, actors, or raw message payloads when
  // team membership has been revoked or the team was deleted.
  if (!activeTeam) {
    return buildUnavailableDTO(
      row,
      null,
      { name: "Unavailable", image: null, isDeleted: false },
      REVOKED_TEAM_NOTIFICATION_MESSAGE,
    );
  }

  const actor = resolveNotificationActor(row.actor);
  const team = { id: activeTeam.id, name: activeTeam.name };
  const isTaskEvent = TASK_NOTIFICATION_TYPES.has(row.type);

  if (isTaskEvent) {
    if (!row.task || row.task.deletedAt !== null) {
      return buildUnavailableDTO(
        row,
        team,
        actor,
        DELETED_TASK_NOTIFICATION_MESSAGE,
      );
    }

    const currentProject = row.task.project ?? row.project;
    if (!currentProject || currentProject.deletedAt !== null) {
      return buildUnavailableDTO(
        row,
        team,
        actor,
        DELETED_PROJECT_NOTIFICATION_MESSAGE,
      );
    }

    return {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message ?? row.title,
      isRead: row.readAt !== null,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      actor,
      team,
      href: `/teams/${activeTeam.id}/projects/${row.task.projectId}`,
      isAccessible: true,
    };
  }

  if (row.projectId !== null && (!row.project || row.project.deletedAt !== null)) {
    return buildUnavailableDTO(
      row,
      team,
      actor,
      DELETED_PROJECT_NOTIFICATION_MESSAGE,
    );
  }

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message ?? row.title,
    isRead: row.readAt !== null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    actor,
    team,
    href: row.project ? `/teams/${activeTeam.id}/projects/${row.project.id}` : null,
    isAccessible: true,
  };
}

/**
 * Counts all unread notifications belonging to the authenticated user across all teams.
 */
export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
}

/**
 * Queries account-wide notifications for the authenticated user using (createdAt, id)
 * keyset cursor pagination, revalidating active team memberships and entity soft-delete state.
 */
export async function queryUserNotifications(
  userId: string,
  options: NotificationsQueryParsed,
): Promise<NotificationsPageDTO> {
  const where = buildNotificationsWhereInput(userId, options);

  const [rows, unreadCount, memberships] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: options.limit + 1,
      select: notificationSelect,
    }) as Promise<RawNotificationRow[]>,
    getUnreadNotificationCount(userId),
    prisma.teamMember.findMany({
      where: {
        userId,
        team: { deletedAt: null },
      },
      select: {
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const activeTeamsMap = new Map<string, ActiveTeamInfo>();
  for (const membership of memberships) {
    if (membership.team) {
      activeTeamsMap.set(membership.teamId, {
        id: membership.team.id,
        name: membership.team.name,
      });
    }
  }

  const hasMore = rows.length > options.limit;
  const pageRows = hasMore ? rows.slice(0, options.limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map((row) => toNotificationDTO(row, activeTeamsMap)),
    unreadCount,
    hasMore,
    nextCursor:
      hasMore && lastRow
        ? encodeNotificationCursor({
            createdAt: lastRow.createdAt,
            id: lastRow.id,
          })
        : null,
  };
}

/**
 * Idempotently marks a user-owned notification as read and revalidates live
 * team membership and target resource accessibility before returning a destination URL.
 */
export async function resolveAndMarkNotificationOpen(
  userId: string,
  notificationId: string,
): Promise<{ found: false } | { found: true; result: OpenNotificationResult }> {
  const row = (await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
    select: notificationSelect,
  })) as RawNotificationRow | null;

  if (!row) {
    return { found: false };
  }

  const now = new Date();
  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      readAt: null,
    },
    data: {
      readAt: now,
    },
  });

  const activeTeamsMap = new Map<string, ActiveTeamInfo>();
  if (row.teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: row.teamId,
          userId,
        },
      },
      select: {
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
          },
        },
      },
    });

    if (membership?.team && membership.team.deletedAt === null) {
      activeTeamsMap.set(membership.teamId, {
        id: membership.team.id,
        name: membership.team.name,
      });
    }
  }

  const dto = toNotificationDTO(row, activeTeamsMap);
  const unreadCount = await getUnreadNotificationCount(userId);

  return {
    found: true,
    result: {
      id: row.id,
      readAt: (row.readAt ?? now).toISOString(),
      unreadCount,
      href: dto.href,
      isAccessible: dto.isAccessible,
      ...(dto.isAccessible ? {} : { unavailableReason: dto.message }),
    },
  };
}
