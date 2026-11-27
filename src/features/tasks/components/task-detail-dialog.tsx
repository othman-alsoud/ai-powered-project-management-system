"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Pencil, Trash2, User as UserIcon, FolderKanban, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { CommentThread } from "@/features/comments/components/comment-thread";
import type { CommentThreadResult } from "@/features/comments/server";
import { formatUtcDateLabel } from "@/features/projects/date-utils";
import type { TeamRole } from "@/generated/prisma/client";
import { updateTaskStatusAction } from "../actions";
import type { TaskSummary } from "../server";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_VALUES,
  type TaskStatusValue,
} from "../validation";
import { TaskDueDate } from "./task-due-date";
import { TaskPriorityBadge } from "./task-priority-badge";
import { TaskStatusBadge } from "./task-status-badge";

interface TaskDetailDialogProps {
  isOpen: boolean;
  teamId: string;
  task: TaskSummary | null;
  currentUserId: string;
  currentUserRole: TeamRole;
  referenceDate?: Date;
  initialCommentsThread?: CommentThreadResult | null;
  onClose: () => void;
  onEdit: (task: TaskSummary) => void;
  onDelete: (task: TaskSummary) => void;
  onStatusChanged: (message: string) => void;
  onCommentMutated?: (message: string) => void;
}

export function TaskDetailDialog(props: TaskDetailDialogProps) {
  if (!props.isOpen || !props.task) return null;
  return <TaskDetailDialogBody key={props.task.id} {...props} task={props.task} />;
}

function TaskDetailDialogBody({
  teamId,
  task,
  currentUserId,
  currentUserRole,
  referenceDate,
  initialCommentsThread,
  onClose,
  onEdit,
  onDelete,
  onStatusChanged,
  onCommentMutated,
}: Omit<TaskDetailDialogProps, "isOpen" | "task"> & { task: TaskSummary }) {
  const canManage = currentUserRole === "OWNER" || currentUserRole === "MANAGER";
  const canUpdateStatus = canManage || task.assignedToId === currentUserId;
  const [statusError, setStatusError] = useState<string | null>(null);
  const [commentNotice, setCommentNotice] = useState<string | null>(null);
  const [isCommentBusy, setIsCommentBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBusy = isPending || isCommentBusy;

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, []);

  function handleCommentMutated(message: string) {
    setCommentNotice(message);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => {
      setCommentNotice(null);
      noticeTimerRef.current = null;
    }, 4000);
    onCommentMutated?.(message);
  }

  function handleStatusChange(nextStatus: TaskStatusValue) {
    setStatusError(null);
    startTransition(async () => {
      const result = await updateTaskStatusAction(teamId, {
        taskId: task.id,
        status: nextStatus,
      });
      if (!result.success) {
        setStatusError(result.error);
        return;
      }
      onStatusChanged(
        result.data.noOp
          ? "Task status is unchanged."
          : `Updated status to ${TASK_STATUS_LABELS[nextStatus]}.`,
      );
      onClose();
    });
  }

  return (
    <ModalDialog
      open={true}
      onClose={() => !isBusy && onClose()}
      labelledBy="task-detail-dialog-title"
      disableClose={isBusy}
      variant="bottom-sheet"
      wrapperClassName="z-50 p-0 sm:p-4"
      panelClassName="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
          <h2
            id="task-detail-dialog-title"
            className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100 break-words"
          >
            {task.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => !isBusy && onClose()}
          disabled={isBusy}
          aria-label="Close dialog"
          className="rounded-lg p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 shrink-0 min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] inline-flex items-center justify-center disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 sm:p-6 flex flex-col gap-5">
        {statusError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300"
          >
            {statusError}
          </div>
        ) : null}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Description
          </p>
          <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
            {task.description ?? "No description provided."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Project
            </p>
            <Link
              href={`/teams/${teamId}/projects/${task.project.id}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 dark:text-teal-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-sm"
            >
              <FolderKanban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{task.project.name}</span>
            </Link>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Assignee
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              <UserIcon className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span>{task.assignee?.name ?? "Unassigned"}</span>
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Due Date
            </p>
            <div className="mt-1">
              <TaskDueDate
                dueDate={task.dueDate}
                status={task.status}
                referenceDate={referenceDate}
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Created / Updated
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Created by {task.createdBy.name ?? "Unknown"} on{" "}
              {formatUtcDateLabel(task.createdAt) ?? "—"}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Updated by {task.updatedBy?.name ?? "Unknown"} on{" "}
              {formatUtcDateLabel(task.updatedAt) ?? "—"}
            </p>
          </div>
        </div>

        {canUpdateStatus ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-3">
            <label
              htmlFor="detail-task-status"
              className="text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Update Status
            </label>
            <select
              id="detail-task-status"
              value={task.status}
              disabled={isBusy}
              onChange={(event) =>
                handleStatusChange(event.target.value as TaskStatusValue)
              }
              className="h-11 md:h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
            >
              {TASK_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {TASK_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {commentNotice ? (
          <div
            role="status"
            className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2 text-xs text-emerald-800 dark:text-emerald-200"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>{commentNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => setCommentNotice(null)}
              className="inline-flex min-h-[44px] md:min-h-0 items-center px-1 text-[11px] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-sm shrink-0"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <CommentThread
          teamId={teamId}
          taskId={task.id}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          initialThread={initialCommentsThread}
          onMutated={handleCommentMutated}
          onBusyChange={setIsCommentBusy}
        />

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => {
                  onClose();
                  onEdit(task);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Edit Task
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isBusy}
                onClick={() => {
                  onClose();
                  onDelete(task);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Delete
              </Button>
            </div>
          ) : (
            <span />
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
