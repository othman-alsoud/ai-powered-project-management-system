import { z } from "zod";
import { TASK_UUID_REGEX, isValidUuid } from "@/features/tasks/validation";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_FEED_DEFAULT_LIMIT,
  ACTIVITY_FEED_MAX_LIMIT,
} from "./constants";
import type {
  ActivityAction,
  ActivityCursor,
  ActivityFeedQueryOptions,
} from "./types";

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
export function encodeActivityCursor(cursor: {
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
 * Decodes and validates a base64url pagination cursor, returning null if invalid or tampered.
 */
export function decodeActivityCursor(cursor: string): ActivityCursor | null {
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

export const activityFeedQuerySchema = z.object({
  limit: z
    .number()
    .int()
    .min(1, { error: "Limit must be at least 1." })
    .max(ACTIVITY_FEED_MAX_LIMIT, {
      error: `Limit must be at most ${ACTIVITY_FEED_MAX_LIMIT}.`,
    })
    .optional()
    .default(ACTIVITY_FEED_DEFAULT_LIMIT),
  cursor: z
    .string()
    .trim()
    .min(1, { error: "Invalid pagination cursor." })
    .transform((value, ctx) => {
      const decoded = decodeActivityCursor(value);
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
  projectId: requiredUuidSchema("project ID").optional(),
  taskId: requiredUuidSchema("task ID").optional(),
  action: z.enum(ACTIVITY_ACTIONS).optional(),
});

export type ActivityFeedQueryInput = z.input<typeof activityFeedQuerySchema>;
export type ActivityFeedQueryParsed = z.output<typeof activityFeedQuerySchema>;

export function activityFieldErrorsFromZod(
  error: z.ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] ? String(issue.path[0]) : "_form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }
  return fieldErrors;
}

export type ActivitySearchParamsState = ActivityFeedQueryOptions;

export type ProjectDetailTab = "tasks" | "activity";

function readSingleParam(
  raw: Record<string, string | string[] | undefined> | URLSearchParams | undefined,
  key: string,
): string | undefined {
  if (!raw) return undefined;
  if (raw instanceof URLSearchParams) {
    return raw.get(key) ?? undefined;
  }
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Safely parses URL search parameters for team/project activity views on a per-field basis,
 * falling back invalid individual fields without discarding valid filters.
 */
export function parseActivitySearchParams(
  raw?: Record<string, string | string[] | undefined> | URLSearchParams,
): ActivitySearchParamsState {
  const rawAction = readSingleParam(raw, "action")?.trim();
  const actionRes = z.enum(ACTIVITY_ACTIONS).safeParse(rawAction);
  const action: ActivityAction | undefined = actionRes.success
    ? actionRes.data
    : undefined;

  const rawProjectId = readSingleParam(raw, "projectId")?.trim();
  const projectId =
    rawProjectId && isValidUuid(rawProjectId) ? rawProjectId : undefined;

  const rawTaskId = readSingleParam(raw, "taskId")?.trim();
  const taskId = rawTaskId && isValidUuid(rawTaskId) ? rawTaskId : undefined;

  const rawLimit = readSingleParam(raw, "limit")?.trim();
  let limit = ACTIVITY_FEED_DEFAULT_LIMIT;
  if (rawLimit && /^\d+$/.test(rawLimit)) {
    const parsedLimit = Number.parseInt(rawLimit, 10);
    if (
      Number.isSafeInteger(parsedLimit) &&
      parsedLimit >= 1 &&
      parsedLimit <= ACTIVITY_FEED_MAX_LIMIT
    ) {
      limit = parsedLimit;
    }
  }

  const rawCursor = readSingleParam(raw, "cursor")?.trim();
  const cursor = rawCursor ? (decodeActivityCursor(rawCursor) ?? undefined) : undefined;

  return {
    limit,
    cursor,
    projectId,
    taskId,
    action,
  };
}

/**
 * Builds a clean URL for URL-synchronized activity filters, stripping transient pagination cursors.
 */
export function buildActivityQueryUrl(
  pathname: string,
  search: string,
  nextFilters: {
    action?: ActivityAction;
    projectId?: string;
    tab?: ProjectDetailTab;
  },
): string {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  params.delete("cursor");

  if (nextFilters.action) {
    params.set("action", nextFilters.action);
  } else {
    params.delete("action");
  }

  if (nextFilters.projectId && isValidUuid(nextFilters.projectId)) {
    params.set("projectId", nextFilters.projectId);
  } else {
    params.delete("projectId");
  }

  if (nextFilters.tab === "activity") {
    params.set("tab", "activity");
  } else if (nextFilters.tab === "tasks") {
    params.delete("tab");
  }

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Parses the ?tab=tasks|activity parameter for Project Detail pages.
 */
export function parseProjectDetailTab(
  raw?: Record<string, string | string[] | undefined> | URLSearchParams,
): ProjectDetailTab {
  const rawTab = readSingleParam(raw, "tab")?.trim().toLowerCase();
  return rawTab === "activity" ? "activity" : "tasks";
}
