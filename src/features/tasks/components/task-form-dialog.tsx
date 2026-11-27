"use client";

import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { toUtcDateInputValue } from "@/features/projects/date-utils";
import { createTaskAction, updateTaskAction } from "../actions";
import type {
  TaskSummary,
  TeamTaskAssigneeOption,
  TeamTaskProjectOption,
} from "../server";
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_VALUES,
  TASK_STATUS_LABELS,
  TASK_STATUS_VALUES,
  TASK_TITLE_MAX_LENGTH,
  createTaskSchema,
  taskFieldErrorsFromZod,
  updateTaskSchema,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "../validation";

export function attemptCloseTaskFormDialog(
  isBusy: boolean,
  onClose: () => void,
): boolean {
  if (isBusy) return false;
  onClose();
  return true;
}

interface TaskFormDialogProps {
  isOpen: boolean;
  mode: "create" | "edit";
  teamId: string;
  task?: TaskSummary | null;
  projects: TeamTaskProjectOption[];
  members: TeamTaskAssigneeOption[];
  defaultProjectId?: string;
  defaultStatus?: TaskStatusValue;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function TaskFormDialog(props: TaskFormDialogProps) {
  if (!props.isOpen) return null;
  if (props.mode === "edit" && !props.task) return null;

  const dialogKey =
    props.mode === "edit" && props.task
      ? `edit-${props.task.id}`
      : `create-${props.defaultProjectId ?? "team"}-${props.defaultStatus ?? "TODO"}`;

  return <TaskFormDialogBody key={dialogKey} {...props} />;
}

function TaskFormDialogBody({
  mode,
  teamId,
  task,
  projects,
  members,
  defaultProjectId,
  defaultStatus,
  onClose,
  onSuccess,
}: TaskFormDialogProps) {
  const initialProjectId =
    task?.projectId ?? defaultProjectId ?? projects[0]?.id ?? "";

  const [projectId, setProjectId] = useState(initialProjectId);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatusValue>(
    task?.status ?? defaultStatus ?? "TODO",
  );
  const [priority, setPriority] = useState<TaskPriorityValue>(
    task?.priority ?? "MEDIUM",
  );
  const [assignedToId, setAssignedToId] = useState(task?.assignedToId ?? "");
  const [dueDate, setDueDate] = useState(
    toUtcDateInputValue(task?.dueDate ?? null),
  );

  const titleInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (mode === "create") {
      const payload = {
        projectId,
        title,
        description,
        status,
        priority,
        dueDate: dueDate || null,
        assignedToId: assignedToId || null,
      };
      const validated = createTaskSchema.safeParse(payload);
      if (!validated.success) {
        setFieldErrors(taskFieldErrorsFromZod(validated.error));
        setErrorMessage("Please fix the validation errors below.");
        return;
      }

      startTransition(async () => {
        const result = await createTaskAction(teamId, payload);
        if (!result.success) {
          setErrorMessage(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }
        onSuccess("Task created successfully.");
        onClose();
      });
      return;
    }

    if (!task) return;

    const payload = {
      taskId: task.id,
      projectId,
      title,
      description,
      status,
      priority,
      dueDate: dueDate || null,
      assignedToId: assignedToId || null,
    };
    const validated = updateTaskSchema.safeParse(payload);
    if (!validated.success) {
      setFieldErrors(taskFieldErrorsFromZod(validated.error));
      setErrorMessage("Please fix the validation errors below.");
      return;
    }

    startTransition(async () => {
      const result = await updateTaskAction(teamId, payload);
      if (!result.success) {
        setErrorMessage(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      onSuccess(
        result.data.noOp ? "No changes were made." : "Task updated successfully.",
      );
      onClose();
    });
  }

  return (
    <ModalDialog
      open={true}
      onClose={() => attemptCloseTaskFormDialog(isPending, onClose)}
      labelledBy="task-form-dialog-title"
      disableClose={isPending}
      initialFocusRef={titleInputRef}
      variant="bottom-sheet"
      wrapperClassName="z-50 p-0 sm:p-4"
      panelClassName="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div>
          <h2
            id="task-form-dialog-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            {mode === "create" ? "Create Task" : "Edit Task"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {mode === "create"
              ? "Add a task to a team project and optionally assign an owner."
              : "Update task details, workflow status, priority, or assignee."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => attemptCloseTaskFormDialog(isPending, onClose)}
          disabled={isPending}
          aria-label="Close dialog"
          className="inline-flex min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] items-center justify-center rounded-lg p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4" noValidate>
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="task-project"
            className="text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Project{" "}
            <span aria-hidden="true" className="text-rose-600 dark:text-rose-400">
              *
            </span>
          </label>
          <select
            id="task-project"
            required
            aria-required="true"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            disabled={isPending || projects.length === 0}
            aria-invalid={Boolean(fieldErrors.projectId?.[0])}
            aria-describedby={
              fieldErrors.projectId?.[0] ? "task-project-error" : undefined
            }
            className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {fieldErrors.projectId?.[0] ? (
            <p
              id="task-project-error"
              role="alert"
              className="text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.projectId[0]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="task-title"
            className="text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Title{" "}
            <span aria-hidden="true" className="text-rose-600 dark:text-rose-400">
              *
            </span>
          </label>
          <input
            ref={titleInputRef}
            id="task-title"
            type="text"
            required
            aria-required="true"
            maxLength={TASK_TITLE_MAX_LENGTH}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isPending}
            placeholder="e.g. Implement OAuth callback validation"
            aria-invalid={Boolean(fieldErrors.title?.[0])}
            aria-describedby={
              fieldErrors.title?.[0] ? "task-title-error" : undefined
            }
            className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
          />
          {fieldErrors.title?.[0] ? (
            <p
              id="task-title-error"
              role="alert"
              className="text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.title[0]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="task-description"
            className="text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Description
          </label>
          <textarea
            id="task-description"
            rows={3}
            maxLength={TASK_DESCRIPTION_MAX_LENGTH}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isPending}
            placeholder="Optional acceptance criteria or context"
            aria-invalid={Boolean(fieldErrors.description?.[0])}
            aria-describedby={
              fieldErrors.description?.[0] ? "task-description-error" : undefined
            }
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
          />
          {fieldErrors.description?.[0] ? (
            <p
              id="task-description-error"
              role="alert"
              className="text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.description[0]}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="task-status"
              className="text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Status
            </label>
            <select
              id="task-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as TaskStatusValue)
              }
              disabled={isPending}
              className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
            >
              {TASK_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {TASK_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="task-priority"
              className="text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as TaskPriorityValue)
              }
              disabled={isPending}
              className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
            >
              {TASK_PRIORITY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {TASK_PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="task-assignee"
              className="text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Assignee
            </label>
            <select
              id="task-assignee"
              value={assignedToId}
              onChange={(event) => setAssignedToId(event.target.value)}
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.assignedToId?.[0])}
              aria-describedby={
                fieldErrors.assignedToId?.[0]
                  ? "task-assignee-error"
                  : undefined
              }
              className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name
                    ? `${member.name} (${member.role})`
                    : `${member.email} (${member.role})`}
                </option>
              ))}
            </select>
            {fieldErrors.assignedToId?.[0] ? (
              <p
                id="task-assignee-error"
                role="alert"
                className="text-xs text-rose-600 dark:text-rose-400"
              >
                {fieldErrors.assignedToId[0]}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="task-due-date"
              className="text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Due Date
            </label>
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.dueDate?.[0])}
              aria-describedby={
                fieldErrors.dueDate?.[0] ? "task-due-date-error" : undefined
              }
              className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
            />
            {fieldErrors.dueDate?.[0] ? (
              <p
                id="task-due-date-error"
                role="alert"
                className="text-xs text-rose-600 dark:text-rose-400"
              >
                {fieldErrors.dueDate[0]}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => attemptCloseTaskFormDialog(isPending, onClose)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isPending} disabled={projects.length === 0}>
            {mode === "create" ? "Create Task" : "Save Changes"}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
