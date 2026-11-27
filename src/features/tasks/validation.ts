import { z } from "zod";
import { parseUtcDateInput } from "@/features/projects/date-utils";

export const TASK_STATUS_VALUES = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
] as const;

export type TaskStatusValue = (typeof TASK_STATUS_VALUES)[number];

export const TASK_PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;

export type TaskPriorityValue = (typeof TASK_PRIORITY_VALUES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatusValue, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriorityValue, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const TASK_TITLE_MIN_LENGTH = 1;
export const TASK_TITLE_MAX_LENGTH = 200;
export const TASK_DESCRIPTION_MAX_LENGTH = 2000;

export const TASK_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return TASK_UUID_REGEX.test(value.trim());
}

const requiredUuidSchema = (fieldLabel: string) =>
  z
    .string({ error: `${fieldLabel} is required` })
    .trim()
    .regex(TASK_UUID_REGEX, { error: `Invalid ${fieldLabel}` });

const nullableUuidSchema = (fieldLabel: string) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .refine((value) => value === null || TASK_UUID_REGEX.test(value), {
      message: `Invalid ${fieldLabel}`,
    });

const requiredTitleSchema = z
  .string({ error: "Task title is required" })
  .trim()
  .min(TASK_TITLE_MIN_LENGTH, { error: "Task title is required" })
  .max(TASK_TITLE_MAX_LENGTH, {
    error: `Task title must be at most ${TASK_TITLE_MAX_LENGTH} characters`,
  });

const nullableDescriptionSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .refine(
    (value) => value === null || value.length <= TASK_DESCRIPTION_MAX_LENGTH,
    {
      message: `Description must be at most ${TASK_DESCRIPTION_MAX_LENGTH} characters`,
    },
  );

function normalizeDateInput(
  value: string | Date | null,
  ctx: z.RefinementCtx,
): Date | null {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Due date must be a valid date in YYYY-MM-DD format",
      });
      return z.NEVER;
    }

    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  const parsed = parseUtcDateInput(value);
  if (parsed === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "Due date must be a valid date in YYYY-MM-DD format",
    });
    return z.NEVER;
  }

  return parsed;
}

const nullableDueDateSchema = z
  .union([z.string(), z.date(), z.null()])
  .transform((value, ctx) => normalizeDateInput(value, ctx));

export const createTaskSchema = z.object({
  projectId: requiredUuidSchema("project ID"),
  title: requiredTitleSchema,
  description: nullableDescriptionSchema.optional().default(null),
  status: z.enum(TASK_STATUS_VALUES).optional().default("TODO"),
  priority: z.enum(TASK_PRIORITY_VALUES).optional().default("MEDIUM"),
  dueDate: nullableDueDateSchema.optional().default(null),
  assignedToId: nullableUuidSchema("assignee ID").optional().default(null),
});

export const updateTaskSchema = z.object({
  taskId: requiredUuidSchema("task ID"),
  projectId: requiredUuidSchema("project ID").optional(),
  title: requiredTitleSchema.optional(),
  description: nullableDescriptionSchema.optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  priority: z.enum(TASK_PRIORITY_VALUES).optional(),
  dueDate: nullableDueDateSchema.optional(),
  assignedToId: nullableUuidSchema("assignee ID").optional(),
});

export const updateTaskStatusSchema = z.object({
  taskId: requiredUuidSchema("task ID"),
  status: z.enum(TASK_STATUS_VALUES),
});

export const deleteTaskSchema = z.object({
  taskId: requiredUuidSchema("task ID"),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type ParsedCreateTaskInput = z.output<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type ParsedUpdateTaskInput = z.output<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type DeleteTaskInput = z.infer<typeof deleteTaskSchema>;

export function taskFieldErrorsFromZod(
  error: z.ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : "_form";
    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    if (!fieldErrors[key].includes(issue.message)) {
      fieldErrors[key].push(issue.message);
    }
  }

  return fieldErrors;
}

/**
 * Checks whether a task due date falls before today's UTC calendar date.
 * Completed tasks (`DONE`) are never marked overdue.
 */
export function isTaskOverdue(
  dueDate: Date | string | null | undefined,
  status: TaskStatusValue,
  referenceDate: Date = new Date(),
): boolean {
  if (!dueDate || status === "DONE") {
    return false;
  }

  const normalizedDueDate =
    dueDate instanceof Date ? dueDate : parseUtcDateInput(dueDate);
  if (!normalizedDueDate || Number.isNaN(normalizedDueDate.getTime())) {
    return false;
  }

  const dueUtcMidnight = Date.UTC(
    normalizedDueDate.getUTCFullYear(),
    normalizedDueDate.getUTCMonth(),
    normalizedDueDate.getUTCDate(),
  );
  const todayUtcMidnight = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  return dueUtcMidnight < todayUtcMidnight;
}

export const TASK_LIST_PAGE_SIZE = 25;
export const TASK_SEARCH_MAX_LENGTH = 100;

export const TASK_DUE_FILTER_VALUES = ["overdue", "today", "this_week"] as const;
export type TaskDueFilterValue = (typeof TASK_DUE_FILTER_VALUES)[number];

export const TASK_DUE_FILTER_LABELS: Record<TaskDueFilterValue, string> = {
  overdue: "Overdue",
  today: "Due Today",
  this_week: "Due This Week",
};

export const TASK_SORT_FIELDS = [
  "createdAt",
  "dueDate",
  "priority",
  "title",
] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export const TASK_SORT_DIRECTIONS = ["asc", "desc"] as const;
export type TaskSortDirection = (typeof TASK_SORT_DIRECTIONS)[number];

export const TASK_SORT_LABELS: Record<TaskSortField, string> = {
  createdAt: "Created Date",
  dueDate: "Due Date",
  priority: "Priority",
  title: "Title",
};

export interface TaskQueryState {
  view: "board" | "list";
  q?: string;
  status?: TaskStatusValue;
  priority?: TaskPriorityValue;
  assignee?: string;
  due?: TaskDueFilterValue;
  sort: TaskSortField;
  dir: TaskSortDirection;
  page: number;
}

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

export function getDefaultTaskSortDirection(
  sort: TaskSortField,
): TaskSortDirection {
  return sort === "dueDate" || sort === "title" ? "asc" : "desc";
}

/**
 * Safely parses URL search parameters for task search, filtering, sorting, view mode, and List pagination.
 * Invalid values fall back cleanly to safe defaults without throwing.
 */
export function parseTaskQueryParams(
  raw?: Record<string, string | string[] | undefined> | URLSearchParams,
): TaskQueryState {
  const rawView = readSingleParam(raw, "view")?.trim().toLowerCase();
  const view: "board" | "list" = rawView === "list" ? "list" : "board";

  const rawQ = readSingleParam(raw, "q")?.trim();
  const q =
    rawQ && rawQ.length > 0
      ? rawQ.slice(0, TASK_SEARCH_MAX_LENGTH)
      : undefined;

  const rawStatus = readSingleParam(raw, "status")?.trim();
  const statusRes = z.enum(TASK_STATUS_VALUES).safeParse(rawStatus);
  const status = statusRes.success ? statusRes.data : undefined;

  const rawPriority = readSingleParam(raw, "priority")?.trim();
  const priorityRes = z.enum(TASK_PRIORITY_VALUES).safeParse(rawPriority);
  const priority = priorityRes.success ? priorityRes.data : undefined;

  const rawAssignee = readSingleParam(raw, "assignee")?.trim();
  let assignee: string | undefined;
  if (rawAssignee === "unassigned") {
    assignee = "unassigned";
  } else if (rawAssignee && isValidUuid(rawAssignee)) {
    assignee = rawAssignee;
  }

  const rawDue = readSingleParam(raw, "due")?.trim().toLowerCase();
  const dueRes = z.enum(TASK_DUE_FILTER_VALUES).safeParse(rawDue);
  const due = dueRes.success ? dueRes.data : undefined;

  const rawSort = readSingleParam(raw, "sort")?.trim();
  const sortRes = z.enum(TASK_SORT_FIELDS).safeParse(rawSort);
  const sort: TaskSortField = sortRes.success ? sortRes.data : "createdAt";

  const rawDir = readSingleParam(raw, "dir")?.trim().toLowerCase();
  const dirRes = z.enum(TASK_SORT_DIRECTIONS).safeParse(rawDir);
  const dir: TaskSortDirection = dirRes.success
    ? dirRes.data
    : getDefaultTaskSortDirection(sort);

  let page = 1;
  if (view === "list") {
    const rawPage = readSingleParam(raw, "page")?.trim();
    if (rawPage && /^\d+$/.test(rawPage)) {
      const parsedPage = Number.parseInt(rawPage, 10);
      if (Number.isSafeInteger(parsedPage) && parsedPage >= 1) {
        page = parsedPage;
      }
    }
  }

  return {
    view,
    q,
    status,
    priority,
    assignee,
    due,
    sort,
    dir,
    page,
  };
}

export function hasActiveTaskFilters(
  query: Pick<
    TaskQueryState,
    "q" | "status" | "priority" | "assignee" | "due"
  >,
): boolean {
  return Boolean(
    query.q ||
      query.status ||
      query.priority ||
      query.assignee ||
      query.due,
  );
}

/**
 * Computes exact UTC calendar boundaries for `overdue`, `today`, and `this_week`
 * (Monday-Sunday UTC calendar week ending Sunday 23:59:59.999 UTC).
 */
export function getUtcDueDateBoundaries(
  due: TaskDueFilterValue,
  referenceDate: Date = new Date(),
): {
  lt?: Date;
  gte?: Date;
  lte?: Date;
  excludeDone: boolean;
} {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const day = referenceDate.getUTCDate();

  const todayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

  if (due === "overdue") {
    return {
      lt: todayStart,
      excludeDone: true,
    };
  }

  if (due === "today") {
    const tomorrowStart = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
    return {
      gte: todayStart,
      lt: tomorrowStart,
      excludeDone: false,
    };
  }

  const daysUntilSunday = (7 - referenceDate.getUTCDay()) % 7;
  const sundayEnd = new Date(
    Date.UTC(year, month, day + daysUntilSunday, 23, 59, 59, 999),
  );
  return {
    gte: todayStart,
    lte: sundayEnd,
    excludeDone: false,
  };
}
