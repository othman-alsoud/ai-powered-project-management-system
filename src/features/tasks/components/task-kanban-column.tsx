"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { TeamRole } from "@/generated/prisma/client";
import {
  canUserMoveTask,
  makeKanbanColumnDroppableId,
} from "../board-utils";
import type { TaskSummary } from "../server";
import {
  TASK_STATUS_LABELS,
  type TaskStatusValue,
} from "../validation";
import { TaskKanbanCard } from "./task-kanban-card";

const COLUMN_DOT_STYLES: Record<TaskStatusValue, string> = {
  TODO: "bg-slate-400 dark:bg-slate-500",
  IN_PROGRESS: "bg-sky-600 dark:bg-sky-400",
  IN_REVIEW: "bg-violet-600 dark:bg-violet-400",
  DONE: "bg-emerald-600 dark:bg-emerald-400",
};

interface TaskKanbanColumnProps {
  status: TaskStatusValue;
  tasks: TaskSummary[];
  currentUserId: string;
  currentUserRole: TeamRole;
  canManageTasks: boolean;
  hasProjects: boolean;
  scopedProject?: boolean;
  pendingTaskIds: readonly string[];
  referenceDate?: Date;
  onSelectTask: (task: TaskSummary) => void;
  onMoveTaskStatus: (task: TaskSummary, nextStatus: TaskStatusValue) => void;
  onQuickCreate: (status: TaskStatusValue) => void;
}

export function TaskKanbanColumn({
  status,
  tasks,
  currentUserId,
  currentUserRole,
  canManageTasks,
  hasProjects,
  scopedProject = false,
  pendingTaskIds,
  referenceDate,
  onSelectTask,
  onMoveTaskStatus,
  onQuickCreate,
}: TaskKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: makeKanbanColumnDroppableId(status),
    data: { status },
  });

  const label = TASK_STATUS_LABELS[status];

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} column (${tasks.length})`}
      className={`snap-start min-w-0 flex flex-col rounded-xl border transition-colors duration-100 ${
        isOver
          ? "border-teal-500 bg-teal-50/40 dark:bg-teal-950/20 ring-2 ring-teal-500/20"
          : "border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40"
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 px-3.5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full shrink-0 ${COLUMN_DOT_STYLES[status]}`}
          />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200 truncate">
            {label}
          </h2>
          <span className="inline-flex items-center justify-center rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300 tabular-nums">
            {tasks.length}
          </span>
        </div>

        {canManageTasks && hasProjects ? (
          <button
            type="button"
            aria-label={`Create task in ${label}`}
            title={`Create task in ${label}`}
            onClick={() => onQuickCreate(status)}
            className="inline-flex h-11 w-11 md:h-7 md:w-7 items-center justify-center rounded-md border border-transparent text-slate-600 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <div className="flex-1 min-h-[220px] md:min-h-[400px] p-2.5 flex flex-col gap-2.5">
        {tasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 px-3 py-8 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {`No tasks in ${label}`}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskKanbanCard
              key={task.id}
              task={task}
              canMove={canUserMoveTask(task, currentUserId, currentUserRole)}
              isPending={pendingTaskIds.includes(task.id)}
              scopedProject={scopedProject}
              referenceDate={referenceDate}
              onSelectTask={onSelectTask}
              onMoveTaskStatus={onMoveTaskStatus}
            />
          ))
        )}
      </div>
    </section>
  );
}
