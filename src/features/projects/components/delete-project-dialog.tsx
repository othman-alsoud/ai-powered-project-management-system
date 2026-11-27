"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { deleteProjectAction } from "../actions";
import type { ProjectSummary } from "../server";

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  project: ProjectSummary | null;
  redirectOnDelete?: boolean;
  onDeleted?: () => void;
}

export function attemptCloseDeleteDialog(
  isSubmitting: boolean,
  clearError: () => void,
  onOpenChange: (open: boolean) => void
): boolean {
  if (isSubmitting) return false;
  clearError();
  onOpenChange(false);
  return true;
}

function DeleteProjectDialogContent({
  onOpenChange,
  teamId,
  project,
  redirectOnDelete = false,
  onDeleted,
}: Omit<DeleteProjectDialogProps, "open" | "project"> & {
  project: ProjectSummary;
}) {
  const router = useRouter();
  const isSubmittingRef = useRef(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    attemptCloseDeleteDialog(
      isSubmittingRef.current,
      () => setError(null),
      onOpenChange
    );
  };

  const handleConfirmDelete = async () => {
    if (isSubmittingRef.current) return;
    setError(null);

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await deleteProjectAction({
        teamId,
        projectId: project.id,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setError(null);
      onOpenChange(false);
      onDeleted?.();

      if (redirectOnDelete) {
        router.push(`/teams/${teamId}/projects`);
      }
    } catch {
      setError("Failed to delete project. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <ModalDialog
      open={true}
      onClose={handleClose}
      labelledBy="delete-project-dialog-title"
      disableClose={isSubmitting}
      initialFocusRef={cancelButtonRef}
      variant="bottom-sheet"
      wrapperClassName="z-50 p-0 sm:p-4"
      panelClassName="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900/60">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="delete-project-dialog-title"
                className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
              >
                Delete Project
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Remove this project from active workspace views.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="inline-flex min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] items-center justify-center rounded-lg p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {project.name}
          </span>
          ? It will be hidden from active project lists while preserving historical
          activity logs.
        </p>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmDelete}
            isLoading={isSubmitting}
          >
            Delete Project
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}

export function DeleteProjectDialog(props: DeleteProjectDialogProps) {
  if (!props.open || !props.project) return null;

  return (
    <DeleteProjectDialogContent
      key={props.project.id}
      onOpenChange={props.onOpenChange}
      teamId={props.teamId}
      project={props.project}
      redirectOnDelete={props.redirectOnDelete}
      onDeleted={props.onDeleted}
    />
  );
}
