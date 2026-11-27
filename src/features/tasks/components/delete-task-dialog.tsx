"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { deleteTaskAction } from "../actions";
import type { TaskSummary } from "../server";

export function attemptCloseDeleteTaskDialog(
  isPending: boolean,
  onClose: () => void,
): boolean {
  if (isPending) return false;
  onClose();
  return true;
}

interface DeleteTaskDialogProps {
  isOpen: boolean;
  teamId: string;
  task: TaskSummary | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function DeleteTaskDialog({
  isOpen,
  teamId,
  task,
  onClose,
  onSuccess,
}: DeleteTaskDialogProps) {
  if (!isOpen || !task) return null;

  return (
    <DeleteTaskDialogBody
      key={task.id}
      teamId={teamId}
      task={task}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function DeleteTaskDialogBody({
  teamId,
  task,
  onClose,
  onSuccess,
}: {
  teamId: string;
  task: TaskSummary;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteTaskAction(teamId, { taskId: task.id });
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }
      onSuccess(`Deleted task "${task.title}".`);
      onClose();
    });
  }

  return (
    <ModalDialog
      open={true}
      onClose={() => attemptCloseDeleteTaskDialog(isPending, onClose)}
      labelledBy="delete-task-dialog-title"
      disableClose={isPending}
      initialFocusRef={cancelButtonRef}
      variant="bottom-sheet"
      wrapperClassName="z-50 p-0 sm:p-4"
      panelClassName="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2
            id="delete-task-dialog-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Delete Task
          </h2>
        </div>
        <button
          type="button"
          onClick={() => attemptCloseDeleteTaskDialog(isPending, onClose)}
          disabled={isPending}
          aria-label="Close dialog"
          className="inline-flex min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] items-center justify-center rounded-lg p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-6 flex flex-col gap-4">
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300"
          >
            {errorMessage}
          </div>
        ) : null}

        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {task.title}
          </span>
          ? This removes the task from active team and project views while
          preserving audit history.
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outline"
            onClick={() => attemptCloseDeleteTaskDialog(isPending, onClose)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            isLoading={isPending}
          >
            Delete Task
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
