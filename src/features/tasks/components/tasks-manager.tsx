"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  CheckSquare,
  Columns3,
  Eye,
  FolderKanban,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ActionResult } from "@/features/teams/actions";
import type { TeamRole } from "@/generated/prisma/client";
import { updateTaskStatusAction } from "../actions";
import {
  applyOptimisticTaskStatus,
  canUserMoveTask,
  type TasksViewMode,
} from "../board-utils";
import type {
  TaskSummary,
  TeamTaskAssigneeOption,
  TeamTaskProjectOption,
} from "../server";
import {
  TASK_LIST_PAGE_SIZE,
  TASK_STATUS_LABELS,
  TASK_STATUS_VALUES,
  getDefaultTaskSortDirection,
  hasActiveTaskFilters,
  parseTaskQueryParams,
  type TaskQueryState,
  type TaskSortField,
  type TaskStatusValue,
} from "../validation";
import { DeleteTaskDialog } from "./delete-task-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TaskDueDate } from "./task-due-date";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskKanbanBoard } from "./task-kanban-board";
import { TaskPriorityBadge } from "./task-priority-badge";
import { TaskStatusBadge } from "./task-status-badge";
import { TasksFilterToolbar } from "./tasks-filter-toolbar";

export interface TaskToastTimerRef {
  current: ReturnType<typeof setTimeout> | null;
}

export function clearTaskToastTimer(timerRef: TaskToastTimerRef): void {
  if (timerRef.current !== null) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function scheduleTaskToastTimer(
  timerRef: TaskToastTimerRef,
  onExpire: () => void,
  delayMs = 4500,
): void {
  clearTaskToastTimer(timerRef);
  timerRef.current = setTimeout(() => {
    timerRef.current = null;
    onExpire();
  }, delayMs);
}

export function buildTasksViewUrl(
  pathname: string,
  search: string,
  nextView: TasksViewMode,
): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.set("view", nextView);
  if (nextView === "board") {
    params.delete("page");
    params.delete("sort");
    params.delete("dir");
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildTasksQueryUrl(
  pathname: string,
  search: string,
  nextState: TaskQueryState,
): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.set("view", nextState.view);

  if (nextState.q && nextState.q.trim().length > 0) {
    params.set("q", nextState.q.trim());
  } else {
    params.delete("q");
  }

  if (nextState.status) {
    params.set("status", nextState.status);
  } else {
    params.delete("status");
  }

  if (nextState.priority) {
    params.set("priority", nextState.priority);
  } else {
    params.delete("priority");
  }

  if (nextState.assignee) {
    params.set("assignee", nextState.assignee);
  } else {
    params.delete("assignee");
  }

  if (nextState.due) {
    params.set("due", nextState.due);
  } else {
    params.delete("due");
  }

  if (nextState.view === "list") {
    if (nextState.sort !== "createdAt" || nextState.dir !== "desc") {
      params.set("sort", nextState.sort);
      params.set("dir", nextState.dir);
    } else {
      params.delete("sort");
      params.delete("dir");
    }

    if (nextState.page > 1) {
      params.set("page", String(nextState.page));
    } else {
      params.delete("page");
    }
  } else {
    params.delete("sort");
    params.delete("dir");
    params.delete("page");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export async function executeOptimisticTaskStatusMove(params: {
  teamId: string;
  task: TaskSummary;
  nextStatus: TaskStatusValue;
  pendingTaskIds: readonly string[];
  setTasks: (updater: (prev: TaskSummary[]) => TaskSummary[]) => void;
  setPendingTaskIds: (updater: (prev: string[]) => string[]) => void;
  updateStatus: (
    teamId: string,
    input: { taskId: string; status: TaskStatusValue },
  ) => Promise<ActionResult<{ id: string; status: TaskStatusValue; noOp?: boolean }>>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}): Promise<void> {
  const {
    teamId,
    task,
    nextStatus,
    pendingTaskIds,
    setTasks,
    setPendingTaskIds,
    updateStatus,
    onSuccess,
    onError,
    onRefresh,
  } = params;

  if (task.status === nextStatus || pendingTaskIds.includes(task.id)) {
    return;
  }

  const previousStatus = task.status;

  setTasks((prev) => applyOptimisticTaskStatus(prev, task.id, nextStatus));
  setPendingTaskIds((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]));

  try {
    const result = await updateStatus(teamId, {
      taskId: task.id,
      status: nextStatus,
    });

    if (!result.success) {
      setTasks((prev) => applyOptimisticTaskStatus(prev, task.id, previousStatus));
      onError(result.error);
      onRefresh();
      return;
    }

    if (!result.data.noOp) {
      onSuccess(`Updated "${task.title}" to ${TASK_STATUS_LABELS[nextStatus]}.`);
      onRefresh();
    }
  } catch {
    setTasks((prev) => applyOptimisticTaskStatus(prev, task.id, previousStatus));
    onError("Unable to update task status. Please try again.");
    onRefresh();
  } finally {
    setPendingTaskIds((prev) => prev.filter((id) => id !== task.id));
  }
}

interface TasksManagerProps {
  teamId: string;
  tasks: TaskSummary[];
  projects: TeamTaskProjectOption[];
  members: TeamTaskAssigneeOption[];
  currentUserId: string;
  currentUserRole: TeamRole;
  scopedProjectId?: string;
  initialView?: TasksViewMode;
  query?: TaskQueryState;
  totalCount?: number;
  totalPages?: number;
  pageSize?: number;
  referenceDateIso?: string;
}

export function TasksManager({
  teamId,
  tasks,
  projects,
  members,
  currentUserId,
  currentUserRole,
  scopedProjectId,
  initialView = "board",
  query,
  totalCount,
  totalPages = 1,
  pageSize = TASK_LIST_PAGE_SIZE,
  referenceDateIso,
}: TasksManagerProps) {
  const router = useRouter();
  const canManageTasks =
    currentUserRole === "OWNER" || currentUserRole === "MANAGER";
  const referenceDate = referenceDateIso
    ? new Date(referenceDateIso)
    : undefined;

  const resolvedQuery =
    query ?? parseTaskQueryParams({ view: initialView });

  const [prevTasks, setPrevTasks] = useState(tasks);
  const [optimisticTasks, setOptimisticTasks] = useState(tasks);
  if (prevTasks !== tasks) {
    setPrevTasks(tasks);
    setOptimisticTasks(tasks);
  }

  const [prevPropQuery, setPrevPropQuery] = useState(resolvedQuery);
  const [activeQuery, setActiveQuery] = useState<TaskQueryState>(resolvedQuery);
  if (prevPropQuery !== resolvedQuery) {
    setPrevPropQuery(resolvedQuery);
    setActiveQuery(resolvedQuery);
  }

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] =
    useState<TaskStatusValue>("TODO");
  const [editingTask, setEditingTask] = useState<TaskSummary | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskSummary | null>(null);
  const [detailTask, setDetailTask] = useState<TaskSummary | null>(null);

  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = toastTimerRef;
    return () => {
      clearTaskToastTimer(timer);
    };
  }, []);

  function showToast(message: string) {
    setActionError(null);
    setToastMessage(message);
    scheduleTaskToastTimer(toastTimerRef, () => {
      setToastMessage(null);
    });
  }

  function handleMutationSuccess(message: string) {
    showToast(message);
  }

  const navigateWithQuery = useCallback(
    (nextQuery: TaskQueryState) => {
      setActiveQuery(nextQuery);
      if (typeof window !== "undefined") {
        const nextUrl = buildTasksQueryUrl(
          window.location.pathname,
          window.location.search,
          nextQuery,
        );
        router.push(nextUrl, { scroll: false });
      }
    },
    [router],
  );

  const handleQueryChange = useCallback(
    (patch: Partial<TaskQueryState>) => {
      const shouldResetPage =
        patch.q !== undefined ||
        "q" in patch ||
        "status" in patch ||
        "priority" in patch ||
        "assignee" in patch ||
        "due" in patch ||
        patch.sort !== undefined ||
        patch.dir !== undefined ||
        patch.view !== undefined;

      const nextQuery: TaskQueryState = {
        ...activeQuery,
        ...patch,
        page:
          patch.view === "board"
            ? 1
            : shouldResetPage && patch.page === undefined
              ? 1
              : (patch.page ?? activeQuery.page),
      };

      navigateWithQuery(nextQuery);
    },
    [activeQuery, navigateWithQuery],
  );

  const handleClearFilters = useCallback(() => {
    navigateWithQuery({
      ...activeQuery,
      q: undefined,
      status: undefined,
      priority: undefined,
      assignee: undefined,
      due: undefined,
      page: 1,
    });
  }, [activeQuery, navigateWithQuery]);

  function handleViewChange(nextView: TasksViewMode) {
    if (nextView === activeQuery.view) return;
    handleQueryChange({ view: nextView, page: 1 });
  }

  function handleColumnHeaderSort(field: TaskSortField) {
    const nextDir =
      activeQuery.sort === field
        ? activeQuery.dir === "asc"
          ? "desc"
          : "asc"
        : getDefaultTaskSortDirection(field);
    handleQueryChange({ sort: field, dir: nextDir });
  }

  function renderColumnSortIcon(field: TaskSortField) {
    if (activeQuery.sort !== field) {
      return (
        <ArrowUpDown
          className="h-3.5 w-3.5 text-slate-400 shrink-0"
          aria-hidden="true"
        />
      );
    }
    return activeQuery.dir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    );
  }

  function handleOpenCreate(defaultStatus: TaskStatusValue = "TODO") {
    setCreateDefaultStatus(defaultStatus);
    setIsCreateOpen(true);
  }

  function handleStatusTransition(
    task: TaskSummary,
    nextStatus: TaskStatusValue,
  ) {
    if (!canUserMoveTask(task, currentUserId, currentUserRole)) {
      return;
    }

    setActionError(null);
    void executeOptimisticTaskStatusMove({
      teamId,
      task,
      nextStatus,
      pendingTaskIds,
      setTasks: setOptimisticTasks,
      setPendingTaskIds,
      updateStatus: updateTaskStatusAction,
      onSuccess: (message) => showToast(message),
      onError: (message) => setActionError(message),
      onRefresh: () => router.refresh(),
    });
  }

  function renderStatusControl(task: TaskSummary) {
    const canChangeStatus = canUserMoveTask(task, currentUserId, currentUserRole);
    const isTaskUpdating = pendingTaskIds.includes(task.id);

    if (!canChangeStatus) {
      return <TaskStatusBadge status={task.status} />;
    }

    return (
      <select
        aria-label={`Change status for ${task.title}`}
        value={task.status}
        disabled={isTaskUpdating}
        onChange={(event) =>
          handleStatusTransition(
            task,
            event.target.value as TaskStatusValue,
          )
        }
        className="h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600 disabled:opacity-50"
      >
        {TASK_STATUS_VALUES.map((value) => (
          <option key={value} value={value}>
            {TASK_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
    );
  }

  const hasProjects = projects.length > 0;
  const filtersActive = hasActiveTaskFilters(activeQuery);
  const displayedTotalCount = totalCount ?? optimisticTasks.length;
  const headingTitle = scopedProjectId ? "Project Tasks" : "Tasks";
  const headingDescription = scopedProjectId
    ? "Track deliverables, assignments, due dates, and progress inside this project."
    : "Coordinate work across your team projects, assignees, priorities, and deadlines.";

  const activeDetailTask = detailTask
    ? optimisticTasks.find((t) => t.id === detailTask.id) ?? detailTask
    : null;

  const listRangeStart =
    displayedTotalCount === 0
      ? 0
      : (activeQuery.page - 1) * pageSize + 1;
  const listRangeEnd = Math.min(
    activeQuery.page * pageSize,
    displayedTotalCount,
  );

  return (
    <section aria-label={headingTitle} className="flex flex-col gap-6 min-w-0 w-full">
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {scopedProjectId ? (
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {headingTitle}
              </h2>
            ) : (
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {headingTitle}
              </h1>
            )}
            <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums">
              {displayedTotalCount}{" "}
              {displayedTotalCount === 1 ? "task" : "tasks"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {headingDescription}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <div
            role="group"
            aria-label="Task view mode"
            className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5"
          >
            <button
              type="button"
              aria-pressed={activeQuery.view === "board"}
              onClick={() => handleViewChange("board")}
              className={`inline-flex h-11 md:h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 ${
                activeQuery.view === "board"
                  ? "bg-teal-700 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Board</span>
            </button>
            <button
              type="button"
              aria-pressed={activeQuery.view === "list"}
              onClick={() => handleViewChange("list")}
              className={`inline-flex h-11 md:h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 ${
                activeQuery.view === "list"
                  ? "bg-teal-700 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>List</span>
            </button>
          </div>

          {canManageTasks ? (
            hasProjects ? (
              <Button
                type="button"
                onClick={() => handleOpenCreate("TODO")}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                New Task
              </Button>
            ) : (
              <Link
                href={`/teams/${teamId}/projects`}
                className="inline-flex h-11 md:h-10 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors shrink-0"
              >
                Create a Project First
              </Link>
            )
          ) : null}
        </div>
      </div>

      <TasksFilterToolbar
        query={activeQuery}
        members={members}
        onQueryChange={handleQueryChange}
        onClearFilters={handleClearFilters}
      />

      {toastMessage ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>{toastMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              clearTaskToastTimer(toastTimerRef);
              setToastMessage(null);
            }}
            className="inline-flex min-h-[44px] md:min-h-0 items-center px-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-sm shrink-0"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
        >
          {actionError}
        </div>
      ) : null}

      {activeQuery.view === "board" ? (
        <div className="flex flex-col gap-4">
          {!hasProjects && canManageTasks ? (
            <Card className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Create a project first before creating and assigning tasks on the
                board.
              </p>
              <Link
                href={`/teams/${teamId}/projects`}
                className="inline-flex h-11 md:h-8 items-center justify-center rounded-md bg-teal-700 px-3 text-xs font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors shrink-0"
              >
                Go to Projects
              </Link>
            </Card>
          ) : null}

          {optimisticTasks.length === 0 && filtersActive ? (
            <Card className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                No matching tasks found for the current search or filters.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Clear filters
              </Button>
            </Card>
          ) : null}

          <TaskKanbanBoard
            tasks={optimisticTasks}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            canManageTasks={canManageTasks}
            hasProjects={hasProjects}
            scopedProject={Boolean(scopedProjectId)}
            pendingTaskIds={pendingTaskIds}
            referenceDate={referenceDate}
            onSelectTask={setDetailTask}
            onMoveTaskStatus={handleStatusTransition}
            onQuickCreate={handleOpenCreate}
          />
        </div>
      ) : optimisticTasks.length === 0 ? (
        filtersActive ? (
          <Card className="p-8 sm:p-10 text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <CheckSquare className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                No matching tasks
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Try adjusting your search or clearing active filters.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
                className="mt-1"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Clear filters
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-8 sm:p-10 text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400">
                <CheckSquare className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                No tasks yet
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {!hasProjects
                  ? "Create a project first before creating and assigning tasks."
                  : canManageTasks
                    ? "Create your first task to start tracking ownership, priorities, and deadlines."
                    : "Tasks assigned to your team projects will appear here once created."}
              </p>
              {canManageTasks && hasProjects ? (
                <Button
                  type="button"
                  onClick={() => handleOpenCreate("TODO")}
                  className="mt-1"
                >
                  <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  Create Task
                </Button>
              ) : !hasProjects ? (
                <Link
                  href={`/teams/${teamId}/projects`}
                  className="mt-1 inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors"
                >
                  Go to Projects
                </Link>
              ) : null}
            </div>
          </Card>
        )
      ) : (
        <>
          {/* Desktop Table (>= 1024px) */}
          <Card className="hidden lg:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                    <th
                      scope="col"
                      aria-sort={
                        activeQuery.sort === "title"
                          ? activeQuery.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                    >
                      <button
                        type="button"
                        onClick={() => handleColumnHeaderSort("title")}
                        className={`inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded ${
                          activeQuery.sort === "title"
                            ? "font-bold text-slate-900 dark:text-slate-100"
                            : ""
                        }`}
                      >
                        <span>Task</span>
                        {renderColumnSortIcon("title")}
                      </button>
                    </th>
                    {!scopedProjectId ? (
                      <th
                        scope="col"
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                      >
                        Project
                      </th>
                    ) : null}
                    <th
                      scope="col"
                      className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        activeQuery.sort === "priority"
                          ? activeQuery.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                    >
                      <button
                        type="button"
                        onClick={() => handleColumnHeaderSort("priority")}
                        className={`inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded ${
                          activeQuery.sort === "priority"
                            ? "font-bold text-slate-900 dark:text-slate-100"
                            : ""
                        }`}
                      >
                        <span>Priority</span>
                        {renderColumnSortIcon("priority")}
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                    >
                      Assignee
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        activeQuery.sort === "dueDate"
                          ? activeQuery.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                    >
                      <button
                        type="button"
                        onClick={() => handleColumnHeaderSort("dueDate")}
                        className={`inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded ${
                          activeQuery.sort === "dueDate"
                            ? "font-bold text-slate-900 dark:text-slate-100"
                            : ""
                        }`}
                      >
                        <span>Due Date</span>
                        {renderColumnSortIcon("dueDate")}
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {optimisticTasks.map((task) => (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3.5 max-w-xs">
                        <button
                          type="button"
                          onClick={() => setDetailTask(task)}
                          className="text-left font-medium text-sm text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 transition-colors line-clamp-1"
                        >
                          {task.title}
                        </button>
                        {task.description ? (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {task.description}
                          </p>
                        ) : null}
                      </td>

                      {!scopedProjectId ? (
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Link
                            href={`/teams/${teamId}/projects/${task.project.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400"
                          >
                            <FolderKanban className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate max-w-[150px]">
                              {task.project.name}
                            </span>
                          </Link>
                        </td>
                      ) : null}

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {renderStatusControl(task)}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <TaskPriorityBadge priority={task.priority} />
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5">
                          <UserIcon
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                          <span className="truncate max-w-[140px]">
                            {task.assignee?.name ?? "Unassigned"}
                          </span>
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <TaskDueDate
                          dueDate={task.dueDate}
                          status={task.status}
                          referenceDate={referenceDate}
                        />
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`View task ${task.title}`}
                            onClick={() => setDetailTask(task)}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          {canManageTasks ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit task ${task.title}`}
                                onClick={() => setEditingTask(task)}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete task ${task.title}`}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                onClick={() => setDeletingTask(task)}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Tablet & Mobile Cards (< 1024px) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {optimisticTasks.map((task) => (
              <Card key={task.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setDetailTask(task)}
                      className="text-left text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 break-words"
                    >
                      {task.title}
                    </button>
                    {!scopedProjectId ? (
                      <Link
                        href={`/teams/${teamId}/projects/${task.project.id}`}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400"
                      >
                        <FolderKanban className="h-3 w-3 shrink-0" />
                        <span className="truncate">{task.project.name}</span>
                      </Link>
                    ) : null}
                  </div>
                  <TaskPriorityBadge priority={task.priority} />
                </div>

                {task.description ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {task.description}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <UserIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {task.assignee?.name ?? "Unassigned"}
                    </span>
                  </span>
                  <TaskDueDate
                    dueDate={task.dueDate}
                    status={task.status}
                    referenceDate={referenceDate}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div>{renderStatusControl(task)}</div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`View task ${task.title}`}
                      onClick={() => setDetailTask(task)}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    {canManageTasks ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit task ${task.title}`}
                          onClick={() => setEditingTask(task)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete task ${task.title}`}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                          onClick={() => setDeletingTask(task)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              aria-label="Task list pagination"
              className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {`Showing ${listRangeStart}–${listRangeEnd} of ${displayedTotalCount} tasks`}
              </p>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={activeQuery.page <= 1}
                  onClick={() =>
                    handleQueryChange({ page: Math.max(1, activeQuery.page - 1) })
                  }
                  className="min-h-[44px] sm:min-h-[36px]"
                >
                  &lt; Previous
                </Button>

                <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                  Page{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {activeQuery.page}
                  </span>{" "}
                  of {totalPages}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={activeQuery.page >= totalPages}
                  onClick={() =>
                    handleQueryChange({
                      page: Math.min(totalPages, activeQuery.page + 1),
                    })
                  }
                  className="min-h-[44px] sm:min-h-[36px]"
                >
                  Next &gt;
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}

      {canManageTasks ? (
        <>
          <TaskFormDialog
            isOpen={isCreateOpen}
            mode="create"
            teamId={teamId}
            projects={projects}
            members={members}
            defaultProjectId={scopedProjectId}
            defaultStatus={createDefaultStatus}
            onClose={() => setIsCreateOpen(false)}
            onSuccess={handleMutationSuccess}
          />
          <TaskFormDialog
            isOpen={editingTask !== null}
            mode="edit"
            teamId={teamId}
            task={editingTask}
            projects={projects}
            members={members}
            onClose={() => setEditingTask(null)}
            onSuccess={handleMutationSuccess}
          />
          <DeleteTaskDialog
            isOpen={deletingTask !== null}
            teamId={teamId}
            task={deletingTask}
            onClose={() => setDeletingTask(null)}
            onSuccess={handleMutationSuccess}
          />
        </>
      ) : null}

      <TaskDetailDialog
        isOpen={activeDetailTask !== null}
        teamId={teamId}
        task={activeDetailTask}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        referenceDate={referenceDate}
        onClose={() => setDetailTask(null)}
        onEdit={(task) => setEditingTask(task)}
        onDelete={(task) => setDeletingTask(task)}
        onStatusChanged={handleMutationSuccess}
        onCommentMutated={handleMutationSuccess}
      />
    </section>
  );
}
