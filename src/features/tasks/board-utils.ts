import type { TeamRole } from "@/generated/prisma/client";
import type { TaskSummary } from "./server";
import {
  TASK_STATUS_VALUES,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "./validation";

export type TasksViewMode = "board" | "list";

export const TASK_PRIORITY_ORDER: Record<TaskPriorityValue, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export const KANBAN_COLUMN_PREFIX = "column:";
export const KANBAN_TAB_PREFIX = "tab:";

export function makeKanbanColumnDroppableId(status: TaskStatusValue): string {
  return `${KANBAN_COLUMN_PREFIX}${status}`;
}

export function makeKanbanTabDroppableId(status: TaskStatusValue): string {
  return `${KANBAN_TAB_PREFIX}${status}`;
}

export function parseTasksViewMode(
  raw: string | string[] | null | undefined,
): TasksViewMode {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate) return "board";
  const normalized = candidate.trim().toLowerCase();
  return normalized === "list" ? "list" : "board";
}

function toTimestampOrNull(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Deterministic column sort order:
 * 1. Priority: HIGH -> MEDIUM -> LOW
 * 2. Earliest non-null dueDate first; null due dates last
 * 3. createdAt descending
 * 4. id ascending
 */
export function compareKanbanTasks(a: TaskSummary, b: TaskSummary): number {
  const priorityDiff =
    (TASK_PRIORITY_ORDER[a.priority] ?? Number.MAX_SAFE_INTEGER) -
    (TASK_PRIORITY_ORDER[b.priority] ?? Number.MAX_SAFE_INTEGER);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const aDue = toTimestampOrNull(a.dueDate);
  const bDue = toTimestampOrNull(b.dueDate);
  if (aDue !== null && bDue === null) return -1;
  if (aDue === null && bDue !== null) return 1;
  if (aDue !== null && bDue !== null && aDue !== bDue) {
    return aDue - bDue;
  }

  const aCreated = toTimestampOrNull(a.createdAt) ?? 0;
  const bCreated = toTimestampOrNull(b.createdAt) ?? 0;
  if (aCreated !== bCreated) {
    return bCreated - aCreated;
  }

  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Groups tasks into the four Kanban status columns and sorts each column deterministically.
 */
export function groupTasksByStatus(
  tasks: readonly TaskSummary[],
): Record<TaskStatusValue, TaskSummary[]> {
  const columns: Record<TaskStatusValue, TaskSummary[]> = {
    TODO: [],
    IN_PROGRESS: [],
    IN_REVIEW: [],
    DONE: [],
  };

  for (const task of tasks) {
    if ((TASK_STATUS_VALUES as readonly string[]).includes(task.status)) {
      columns[task.status].push(task);
    }
  }

  for (const status of TASK_STATUS_VALUES) {
    columns[status].sort(compareKanbanTasks);
  }

  return columns;
}

/**
 * Mirrors server-side authorization rules for UI controls:
 * OWNER/MANAGER may move any team task; MEMBER only tasks assigned to themselves.
 */
export function canUserMoveTask(
  task: Pick<TaskSummary, "assignedToId">,
  currentUserId: string,
  currentUserRole: TeamRole,
): boolean {
  if (currentUserRole === "OWNER" || currentUserRole === "MANAGER") {
    return true;
  }
  return task.assignedToId === currentUserId;
}

/**
 * Returns a new task list with the target task's status optimistically updated.
 */
export function applyOptimisticTaskStatus(
  tasks: readonly TaskSummary[],
  taskId: string,
  nextStatus: TaskStatusValue,
): TaskSummary[] {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, status: nextStatus } : task,
  );
}

/**
 * Resolves a dnd-kit drop target ID (column ID, mobile tab ID, raw status, or task ID) to a TaskStatusValue.
 */
export function resolveDragDropTargetStatus(
  overId: string | number | null | undefined,
  tasks: readonly TaskSummary[],
): TaskStatusValue | null {
  if (overId === null || overId === undefined) {
    return null;
  }

  const raw = String(overId);
  let candidate = raw;
  if (raw.startsWith(KANBAN_COLUMN_PREFIX)) {
    candidate = raw.slice(KANBAN_COLUMN_PREFIX.length);
  } else if (raw.startsWith(KANBAN_TAB_PREFIX)) {
    candidate = raw.slice(KANBAN_TAB_PREFIX.length);
  }

  if ((TASK_STATUS_VALUES as readonly string[]).includes(candidate)) {
    return candidate as TaskStatusValue;
  }

  const matchedTask = tasks.find((task) => task.id === raw);
  return matchedTask ? matchedTask.status : null;
}
