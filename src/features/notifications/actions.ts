"use server";

import { getActionUser } from "@/features/auth/server";
import type { ActionResult } from "@/features/teams/actions";
import { prisma } from "@/lib/prisma";
import {
  getUnreadNotificationCount,
  queryUserNotifications,
  resolveAndMarkNotificationOpen,
} from "./server";
import type { NotificationsPageDTO, OpenNotificationResult } from "./types";
import {
  notificationFieldErrorsFromZod,
  notificationIdSchema,
  notificationsQuerySchema,
  type NotificationIdInput,
  type NotificationsQueryInput,
} from "./validation";

/**
 * Returns the authenticated user's account-wide unread notification count across all teams.
 */
export async function getUnreadCountAction(): Promise<
  ActionResult<{ unreadCount: number }>
> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  try {
    const unreadCount = await getUnreadNotificationCount(user.id);
    return {
      success: true,
      data: { unreadCount },
    };
  } catch (error) {
    console.error("[getUnreadCountAction] Failed to load unread count:", error);
    return {
      success: false,
      error: "Unable to load notifications.",
    };
  }
}

/**
 * Loads paginated, server-sanitized account-wide notifications for the authenticated user.
 */
export async function getNotificationsAction(
  input: NotificationsQueryInput = {},
): Promise<ActionResult<NotificationsPageDTO>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parsed = notificationsQuerySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: notificationFieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const page = await queryUserNotifications(user.id, parsed.data);
    return {
      success: true,
      data: page,
    };
  } catch (error) {
    console.error("[getNotificationsAction] Failed to load notifications:", error);
    return {
      success: false,
      error: "Unable to load notifications.",
    };
  }
}

/**
 * Idempotently marks a single user-owned notification as read.
 */
export async function markNotificationReadAction(
  input: NotificationIdInput,
): Promise<ActionResult<{ id: string; readAt: string; unreadCount: number }>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parsed = notificationIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: notificationFieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const now = new Date();
    await prisma.notification.updateMany({
      where: {
        id: parsed.data.notificationId,
        userId: user.id,
        readAt: null,
      },
      data: {
        readAt: now,
      },
    });

    const record = await prisma.notification.findFirst({
      where: {
        id: parsed.data.notificationId,
        userId: user.id,
      },
      select: {
        id: true,
        readAt: true,
      },
    });

    if (!record) {
      return {
        success: false,
        error: "Notification not found.",
      };
    }

    const unreadCount = await getUnreadNotificationCount(user.id);
    return {
      success: true,
      data: {
        id: record.id,
        readAt: (record.readAt ?? now).toISOString(),
        unreadCount,
      },
    };
  } catch (error) {
    console.error("[markNotificationReadAction] Failed to mark read:", error);
    return {
      success: false,
      error: "Unable to update notification. Please try again.",
    };
  }
}

/**
 * Marks a notification read and performs live team/resource authorization
 * before returning a safe destination URL.
 */
export async function openNotificationAction(
  input: NotificationIdInput,
): Promise<ActionResult<OpenNotificationResult>> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parsed = notificationIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: notificationFieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const outcome = await resolveAndMarkNotificationOpen(
      user.id,
      parsed.data.notificationId,
    );
    if (!outcome.found) {
      return {
        success: false,
        error: "Notification not found.",
      };
    }

    return {
      success: true,
      data: outcome.result,
    };
  } catch (error) {
    console.error("[openNotificationAction] Failed to open notification:", error);
    return {
      success: false,
      error: "Unable to open notification. Please try again.",
    };
  }
}

/**
 * Marks all unread notifications belonging to the authenticated user as read.
 */
export async function markAllNotificationsReadAction(): Promise<
  ActionResult<{ markedCount: number; unreadCount: number }>
> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    const unreadCount = await getUnreadNotificationCount(user.id);
    return {
      success: true,
      data: {
        markedCount: result.count,
        unreadCount,
      },
    };
  } catch (error) {
    console.error("[markAllNotificationsReadAction] Failed to mark all read:", error);
    return {
      success: false,
      error: "Unable to mark notifications as read. Please try again.",
    };
  }
}
