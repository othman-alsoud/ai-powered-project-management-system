"use client";

import { useRef, useState } from "react";
import { AlertCircle, FolderKanban, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { toUtcDateInputValue } from "../date-utils";
import { createProjectAction, updateProjectAction } from "../actions";
import type { ProjectStatus, ProjectSummary } from "../server";
import {
  PROJECT_STATUSES,
  createProjectSchema,
  updateProjectSchema,
} from "../validation";
import { PROJECT_STATUS_META } from "./project-status-badge";

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  mode: "create" | "edit";
  project?: ProjectSummary | null;
  onSuccess?: (message: string) => void;
}

type FieldErrors = {
  name?: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

function ProjectFormDialogContent({
  onOpenChange,
  teamId,
  mode,
  project,
  onSuccess,
}: Omit<ProjectFormDialogProps, "open">) {
  const isSubmittingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(
    project?.status ?? "PLANNING"
  );
  const [startDate, setStartDate] = useState(
    toUtcDateInputValue(project?.startDate)
  );
  const [endDate, setEndDate] = useState(toUtcDateInputValue(project?.endDate));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmittingRef.current) return;
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setError(null);
    setFieldErrors({});

    const payload =
      mode === "create"
        ? { teamId, name, description, status, startDate, endDate }
        : {
            teamId,
            projectId: project?.id ?? "",
            name,
            description,
            status,
            startDate,
            endDate,
          };

    const parsed =
      mode === "create"
        ? createProjectSchema.safeParse(payload)
        : updateProjectSchema.safeParse(payload);

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key in nextErrors === false) {
          nextErrors[key as keyof FieldErrors] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result =
        mode === "create"
          ? await createProjectAction(payload)
          : await updateProjectAction(payload);

      if (!result.success) {
        if (result.fieldErrors) {
          setFieldErrors({
            name: result.fieldErrors.name?.[0],
            description: result.fieldErrors.description?.[0],
            status: result.fieldErrors.status?.[0],
            startDate: result.fieldErrors.startDate?.[0],
            endDate: result.fieldErrors.endDate?.[0],
          });
        }
        if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
          setError(result.error);
        }
        return;
      }

      onOpenChange(false);
      onSuccess?.(
        mode === "create"
          ? "Project created successfully."
          : "Project updated successfully."
      );
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <ModalDialog
      open={true}
      onClose={handleClose}
      labelledBy="project-form-dialog-title"
      disableClose={isSubmitting}
      initialFocusRef={nameInputRef}
      variant="bottom-sheet"
      wrapperClassName="z-50 p-0 sm:p-4"
      panelClassName="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
              <FolderKanban className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="project-form-dialog-title"
                className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
              >
                {mode === "create" ? "Create Project" : "Edit Project"}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {mode === "create"
                  ? "Organize work within this team workspace."
                  : "Update project details, status, or target timeline."}
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

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="project-name"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Project name{" "}
              <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                *
              </span>
            </label>
            <input
              ref={nameInputRef}
              id="project-name"
              type="text"
              required
              aria-required="true"
              maxLength={100}
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 API Hardening"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "project-name-error" : undefined}
              className={[
                "h-10 w-full rounded-md border bg-white dark:bg-slate-800/80 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                "focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400 transition-all disabled:opacity-50",
                fieldErrors.name
                  ? "border-red-500 ring-2 ring-red-500/20"
                  : "border-slate-300 dark:border-slate-700",
              ].join(" ")}
            />
            {fieldErrors.name && (
              <p
                id="project-name-error"
                role="alert"
                className="text-xs text-red-600 dark:text-red-400"
              >
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="project-status"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Status
            </label>
            <select
              id="project-status"
              disabled={isSubmitting}
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              aria-invalid={Boolean(fieldErrors.status)}
              aria-describedby={
                fieldErrors.status ? "project-status-error" : undefined
              }
              className="h-10 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400 disabled:opacity-50"
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_META[s].label}
                </option>
              ))}
            </select>
            {fieldErrors.status && (
              <p
                id="project-status-error"
                role="alert"
                className="text-xs text-red-600 dark:text-red-400"
              >
                {fieldErrors.status}
              </p>
            )}
          </div>

          {/* Dates (2-column pair) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="project-start-date"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Start date{" "}
                <span className="font-normal text-slate-600 dark:text-slate-400">(optional)</span>
              </label>
              <input
                id="project-start-date"
                type="date"
                disabled={isSubmitting}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-invalid={Boolean(fieldErrors.startDate)}
                aria-describedby={
                  fieldErrors.startDate ? "project-start-date-error" : undefined
                }
                className={[
                  "h-10 w-full rounded-md border bg-white dark:bg-slate-800/80 px-3 text-sm text-slate-900 dark:text-slate-100",
                  "focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400 disabled:opacity-50",
                  fieldErrors.startDate
                    ? "border-red-500 ring-2 ring-red-500/20"
                    : "border-slate-300 dark:border-slate-700",
                ].join(" ")}
              />
              {fieldErrors.startDate && (
                <p
                  id="project-start-date-error"
                  role="alert"
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  {fieldErrors.startDate}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="project-end-date"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                End date{" "}
                <span className="font-normal text-slate-600 dark:text-slate-400">(optional)</span>
              </label>
              <input
                id="project-end-date"
                type="date"
                disabled={isSubmitting}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-invalid={Boolean(fieldErrors.endDate)}
                aria-describedby={
                  fieldErrors.endDate ? "project-end-date-error" : undefined
                }
                className={[
                  "h-10 w-full rounded-md border bg-white dark:bg-slate-800/80 px-3 text-sm text-slate-900 dark:text-slate-100",
                  "focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400 disabled:opacity-50",
                  fieldErrors.endDate
                    ? "border-red-500 ring-2 ring-red-500/20"
                    : "border-slate-300 dark:border-slate-700",
                ].join(" ")}
              />
              {fieldErrors.endDate && (
                <p
                  id="project-end-date-error"
                  role="alert"
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  {fieldErrors.endDate}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="project-description"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Description{" "}
              <span className="font-normal text-slate-600 dark:text-slate-400">(optional)</span>
            </label>
            <textarea
              id="project-description"
              rows={3}
              maxLength={1000}
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Goals, scope, or delivery notes..."
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={
                fieldErrors.description ? "project-description-error" : undefined
              }
              className={[
                "min-h-[80px] w-full resize-y rounded-md border bg-white dark:bg-slate-800/80 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                "focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400 disabled:opacity-50",
                fieldErrors.description
                  ? "border-red-500 ring-2 ring-red-500/20"
                  : "border-slate-300 dark:border-slate-700",
              ].join(" ")}
            />
            {fieldErrors.description && (
              <p
                id="project-description-error"
                role="alert"
                className="text-xs text-red-600 dark:text-red-400"
              >
                {fieldErrors.description}
              </p>
            )}
          </div>

          {/* Footer: Cancel left, Submit right */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {mode === "create" ? "Create Project" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </ModalDialog>
  );
}

export function ProjectFormDialog(props: ProjectFormDialogProps) {
  if (!props.open) return null;

  return (
    <ProjectFormDialogContent
      key={`${props.mode}-${props.project?.id ?? "new"}`}
      onOpenChange={props.onOpenChange}
      teamId={props.teamId}
      mode={props.mode}
      project={props.project}
      onSuccess={props.onSuccess}
    />
  );
}
