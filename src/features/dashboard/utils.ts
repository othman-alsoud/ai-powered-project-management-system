import { TASK_PRIORITY_ORDER } from "@/features/tasks/board-utils";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_VALUES,
  isTaskOverdue,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/features/tasks/validation";

export const DASHBOARD_PRIORITY_DISPLAY_ORDER: readonly TaskPriorityValue[] = [
  "HIGH",
  "MEDIUM",
  "LOW",
];

export const DASHBOARD_TASK_STREAM_LIMIT = 10;
export const DASHBOARD_ACTIVITY_LIMIT = 10;

export interface DashboardStatusItem {
  status: TaskStatusValue;
  label: string;
  count: number;
  percentage: number;
}

export interface DashboardPriorityItem {
  priority: TaskPriorityValue;
  label: string;
  count: number;
  percentage: number;
}

export interface DashboardTaskItem {
  id: string;
  teamId: string;
  projectId: string;
  title: string;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  dueDate: Date | null;
  createdAt: Date;
  project: {
    id: string;
    name: string;
  };
  assignee: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

/**
 * Computes an integer percentage rounded to the nearest whole percent, returning 0 when total <= 0.
 */
export function formatPercentage(count: number, total: number): number {
  if (total <= 0 || count <= 0) {
    return 0;
  }
  return Math.round((count / total) * 100);
}

/**
 * Aggregates task counts across all four canonical statuses in display order.
 */
export function buildStatusBreakdown(
  rows: ReadonlyArray<{ status: TaskStatusValue; count: number }>,
): {
  items: DashboardStatusItem[];
  totalTasks: number;
  inReviewCount: number;
} {
  const countsByStatus = new Map<TaskStatusValue, number>();
  for (const row of rows) {
    countsByStatus.set(
      row.status,
      (countsByStatus.get(row.status) ?? 0) + row.count,
    );
  }

  let totalTasks = 0;
  for (const status of TASK_STATUS_VALUES) {
    totalTasks += countsByStatus.get(status) ?? 0;
  }

  const items: DashboardStatusItem[] = TASK_STATUS_VALUES.map((status) => {
    const count = countsByStatus.get(status) ?? 0;
    return {
      status,
      label: TASK_STATUS_LABELS[status],
      count,
      percentage: formatPercentage(count, totalTasks),
    };
  });

  return {
    items,
    totalTasks,
    inReviewCount: countsByStatus.get("IN_REVIEW") ?? 0,
  };
}

/**
 * Aggregates open task counts across HIGH -> MEDIUM -> LOW priorities.
 */
export function buildPriorityBreakdown(
  rows: ReadonlyArray<{ priority: TaskPriorityValue; count: number }>,
): {
  items: DashboardPriorityItem[];
  totalOpenTasks: number;
} {
  const countsByPriority = new Map<TaskPriorityValue, number>();
  for (const row of rows) {
    countsByPriority.set(
      row.priority,
      (countsByPriority.get(row.priority) ?? 0) + row.count,
    );
  }

  let totalOpenTasks = 0;
  for (const priority of DASHBOARD_PRIORITY_DISPLAY_ORDER) {
    totalOpenTasks += countsByPriority.get(priority) ?? 0;
  }

  const items: DashboardPriorityItem[] = DASHBOARD_PRIORITY_DISPLAY_ORDER.map(
    (priority) => {
      const count = countsByPriority.get(priority) ?? 0;
      return {
        priority,
        label: TASK_PRIORITY_LABELS[priority],
        count,
        percentage: formatPercentage(count, totalOpenTasks),
      };
    },
  );

  return {
    items,
    totalOpenTasks,
  };
}

function toTimestampOrNull(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Deterministic priority stream order:
 * 1. Overdue tasks first
 * 2. Earliest non-null dueDate ascending (null dueDate last)
 * 3. Priority: HIGH -> MEDIUM -> LOW
 * 4. Newest createdAt descending
 * 5. Stable ID ascending
 */
export function sortDashboardPrioritizedTasks<T extends DashboardTaskItem>(
  tasks: readonly T[],
  referenceDate: Date = new Date(),
): T[] {
  return [...tasks].sort((a, b) => {
    const aOverdue = isTaskOverdue(a.dueDate, a.status, referenceDate);
    const bOverdue = isTaskOverdue(b.dueDate, b.status, referenceDate);
    if (aOverdue !== bOverdue) {
      return aOverdue ? -1 : 1;
    }

    const aDue = toTimestampOrNull(a.dueDate);
    const bDue = toTimestampOrNull(b.dueDate);
    if (aDue !== null && bDue === null) return -1;
    if (aDue === null && bDue !== null) return 1;
    if (aDue !== null && bDue !== null && aDue !== bDue) {
      return aDue - bDue;
    }

    const priorityDiff =
      (TASK_PRIORITY_ORDER[a.priority] ?? Number.MAX_SAFE_INTEGER) -
      (TASK_PRIORITY_ORDER[b.priority] ?? Number.MAX_SAFE_INTEGER);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const aCreated = toTimestampOrNull(a.createdAt) ?? 0;
    const bCreated = toTimestampOrNull(b.createdAt) ?? 0;
    if (aCreated !== bCreated) {
      return bCreated - aCreated;
    }

    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}
