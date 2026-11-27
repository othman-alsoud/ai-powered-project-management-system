import { z } from "zod";
import { TASK_UUID_REGEX, isValidUuid } from "@/features/tasks/validation";

export { isValidUuid };

export const COMMENT_MIN_LENGTH = 1;
export const COMMENT_MAX_LENGTH = 2000;
export const COMMENT_THREAD_LIMIT = 200;

const requiredUuidSchema = (fieldLabel: string) =>
  z
    .string({ error: `${fieldLabel} is required` })
    .trim()
    .regex(TASK_UUID_REGEX, { error: `Invalid ${fieldLabel}` });

const requiredCommentContentSchema = z
  .string({ error: "Comment content is required" })
  .transform((value) => value.trim())
  .refine((value) => value.length >= COMMENT_MIN_LENGTH, {
    message: "Comment cannot be empty",
  })
  .refine((value) => value.length <= COMMENT_MAX_LENGTH, {
    message: `Comment must be at most ${COMMENT_MAX_LENGTH} characters`,
  });

export const loadTaskCommentsSchema = z.object({
  taskId: requiredUuidSchema("task ID"),
});

export const createCommentSchema = z.object({
  taskId: requiredUuidSchema("task ID"),
  content: requiredCommentContentSchema,
});

export const updateCommentSchema = z.object({
  commentId: requiredUuidSchema("comment ID"),
  taskId: requiredUuidSchema("task ID"),
  content: requiredCommentContentSchema,
});

export const deleteCommentSchema = z.object({
  commentId: requiredUuidSchema("comment ID"),
  taskId: requiredUuidSchema("task ID"),
});

export type LoadTaskCommentsInput = z.input<typeof loadTaskCommentsSchema>;
export type CreateCommentInput = z.input<typeof createCommentSchema>;
export type UpdateCommentInput = z.input<typeof updateCommentSchema>;
export type DeleteCommentInput = z.input<typeof deleteCommentSchema>;

export function commentFieldErrorsFromZod(
  error: z.ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] ? String(issue.path[0]) : "_form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }
  return fieldErrors;
}

const UTC_COMMENT_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
  timeZoneName: "short",
});

/**
 * Formats a comment timestamp strictly in UTC to remain deterministic across SSR and hydration.
 */
export function formatUtcCommentTimestamp(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return UTC_COMMENT_TIMESTAMP_FORMATTER.format(date);
}
