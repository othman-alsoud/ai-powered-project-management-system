"use client";

import type * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { FolderKanban, GripVertical, User as UserIcon } from "lucide-react";
import type { TaskSummary } from "../server";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_VALUES,
  type TaskStatusValue,
} from "../validation";
import { TaskDueDate } from "./task-due-date";
import { TaskPriorityBadge } from "./task-priority-badge";
import { TaskStatusBadge } from "./task-status-badge";

interface TaskKanbanCardViewProps {
  task: TaskSummary;
  canMove: boolean;
  isPending: boolean;
  scopedProject?: boolean;
  referenceDate?: Date;
  isDragging?: boolean;
  isOverlay?: boolean;
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  onSelectTask: (task: TaskSummary) => void;
  onMoveTaskStatus: (task: TaskSummary, nextStatus: TaskStatusValue) => void;
}

export function TaskKanbanCardView({
  task,
  canMove,
  isPending,
  scopedProject = false,
  referenceDate,
  isDragging = false,
  isOverlay = false,
  dragHandleProps,
  onSelectTask,
  onMoveTaskStatus,
}: TaskKanbanCardViewProps) {
  return (
    <article
      aria-busy={isPending}
      className={`min-w-0 rounded-md border bg-white dark:bg-slate-900 p-3 transition-colors duration-100 ${
        isOverlay
          ? "border-teal-500 shadow-lg ring-2 ring-teal-500/20"
          : isDragging
            ? "border-dashed border-2 border-slate-300 dark:border-slate-600 opacity-40"
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs"
      } ${isPending ? "opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <TaskPriorityBadge priority={task.priority} />

        {canMove && !isOverlay ? (
          <button
            type="button"
            disabled={isPending}
            aria-label={`Drag task ${task.title}`}
            title="Drag to move column (or use keyboard Space + Arrow keys)"
            {...dragHandleProps}
            className={`inline-flex h-11 w-11 md:h-7 md:w-7 items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 touch-none select-none shrink-0 ${
              isPending ? "cursor-not-allowed opacity-50" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-2 min-w-0">
        <button
          type="button"
          onClick={() => onSelectTask(task)}
          className="w-full text-left text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-xs line-clamp-2 break-words"
        >
          {task.title}
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
        {!scopedProject ? (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 max-w-full">
            <FolderKanban className="h-3 w-3 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <span className="truncate max-w-[140px]">{task.project.name}</span>
          </span>
        ) : null}

        <TaskDueDate
          dueDate={task.dueDate}
          status={task.status}
          referenceDate={referenceDate}
        />

        <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 min-w-0">
          <UserIcon className="h-3 w-3 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          <span className="truncate max-w-[120px]">
            {task.assignee?.name ?? "Unassigned"}
          </span>
        </span>
      </div>

      {!isOverlay ? (
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          {canMove ? (
            <select
              aria-label={`Change status for ${task.title}`}
              value={task.status}
              disabled={isPending}
              onChange={(event) =>
                onMoveTaskStatus(task, event.target.value as TaskStatusValue)
              }
              className="h-11 md:h-8 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 disabled:opacity-50"
            >
              {TASK_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {TASK_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          ) : (
            <TaskStatusBadge status={task.status} />
          )}
        </div>
      ) : null}
    </article>
  );
}

interface TaskKanbanCardProps {
  task: TaskSummary;
  canMove: boolean;
  isPending: boolean;
  scopedProject?: boolean;
  referenceDate?: Date;
  onSelectTask: (task: TaskSummary) => void;
  onMoveTaskStatus: (task: TaskSummary, nextStatus: TaskStatusValue) => void;
}

export function TaskKanbanCard({
  task,
  canMove,
  isPending,
  scopedProject = false,
  referenceDate,
  onSelectTask,
  onMoveTaskStatus,
}: TaskKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      disabled: !canMove || isPending,
      data: { task },
    });

  const style: React.CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style}>
      <TaskKanbanCardView
        task={task}
        canMove={canMove}
        isPending={isPending}
        scopedProject={scopedProject}
        referenceDate={referenceDate}
        isDragging={isDragging}
        dragHandleProps={
          canMove
            ? {
                ...attributes,
                ...listeners,
              }
            : undefined
        }
        onSelectTask={onSelectTask}
        onMoveTaskStatus={onMoveTaskStatus}
      />
    </div>
  );
}
