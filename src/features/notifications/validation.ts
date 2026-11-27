import { z } from "zod";
import { TASK_UUID_REGEX, isValidUuid } from "@/features/tasks/validation";
import {
  NOTIFICATIONS_DEFAULT_LIMIT,
  NOTIFICATIONS_MAX_LIMIT,
} from "./constants";
import type { NotificationCursor } from "./types";

export { isValidUuid };

const requiredUuidSchema = (fieldLabel: string) =>
  z
    .string({ error: `${fieldLabel} is required` })
    .trim()
    .regex(TASK_UUID_REGEX, { error: `Invalid ${fieldLabel}` });

const cursorPayloadSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.string().regex(TASK_UUID_REGEX),
});

/**
 * Encodes a deterministic (createdAt, id) keyset pagination cursor as base64url.
 */
export function encodeNotificationCursor(cursor: {
  createdAt: Date | string;
  id: string;
}): string {
  const iso =
    cursor.createdAt instanceof Date
      ? cursor.createdAt.toISOString()
      : new Date(cursor.createdAt).toISOString();

  return Buffer.from(
    JSON.stringify({ createdAt: iso, id: cursor.id }),
    "utf8",
  ).toString("base64url");
}

/**
 * Decodes and validates a base64url notification pagination cursor.
 * Returns null when malformed or tampered.
 */
export function decodeNotificationCursor(
  cursor: string,
): NotificationCursor | null {
  const trimmed = cursor.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const json = Buffer.from(trimmed, "base64url").toString("utf8");
    const parsedJson: unknown = JSON.parse(json);
    const result = cursorPayloadSchema.safeParse(parsedJson);
    if (!result.success) {
      return null;
    }

    const createdAt = new Date(result.data.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return {
      createdAt,
      id: result.data.id,
    };
  } catch {
    return null;
  }
}

export const notificationsQuerySchema = z.object({
  limit: z
    .number()
    .int()
    .min(1, { error: "Limit must be at least 1." })
    .max(NOTIFICATIONS_MAX_LIMIT, {
      error: `Limit must be at most ${NOTIFICATIONS_MAX_LIMIT}.`,
    })
    .optional()
    .default(NOTIFICATIONS_DEFAULT_LIMIT),
  cursor: z
    .string()
    .trim()
    .min(1, { error: "Invalid pagination cursor." })
    .transform((value, ctx) => {
      const decoded = decodeNotificationCursor(value);
      if (!decoded) {
        ctx.addIssue({
          code: "custom",
          message: "Invalid pagination cursor.",
        });
        return z.NEVER;
      }
      return decoded;
    })
    .optional(),
  filter: z.enum(["all", "unread"]).optional().default("all"),
});

export type NotificationsQueryInput = z.input<typeof notificationsQuerySchema>;
export type NotificationsQueryParsed = z.output<typeof notificationsQuerySchema>;

export const notificationIdSchema = z.object({
  notificationId: requiredUuidSchema("notification ID"),
});

export type NotificationIdInput = z.input<typeof notificationIdSchema>;

export function notificationFieldErrorsFromZod(
  error: z.ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] ? String(issue.path[0]) : "_form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }
  return fieldErrors;
}
