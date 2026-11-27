"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { X, Building2, AlertCircle } from "lucide-react";
import { createTeamAction } from "../actions";
import { createTeamSchema } from "../validation";
import { publishTeamSyncEvent } from "../lib/team-sync";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
}

export function CreateTeamModal({ isOpen, onClose, currentUserId }: CreateTeamModalProps) {
  const router = useRouter();
  const isSubmittingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setError(null);
    setNameError(null);

    const validation = createTeamSchema.safeParse({ name, description });
    if (!validation.success) {
      const issue = validation.error.issues[0];
      if (issue?.path[0] === "name") {
        setNameError(issue.message);
      } else {
        setError(issue?.message || "Invalid input.");
      }
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await createTeamAction({ name, description });

      if (!result.success) {
        if (result.fieldErrors?.name) {
          setNameError(result.fieldErrors.name[0] ?? null);
        } else {
          setError(result.error);
        }
        return;
      }

      onClose();
      setName("");
      setDescription("");
      if (currentUserId) {
        publishTeamSyncEvent({
          type: "TEAM_CREATED",
          userId: currentUserId,
          teamId: result.data.teamId,
        });
      }
      router.push(`/teams/${result.data.teamId}`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <ModalDialog
      open={isOpen}
      onClose={onClose}
      labelledBy="create-team-modal-title"
      disableClose={isSubmitting}
      initialFocusRef={nameInputRef}
      variant="bottom-sheet"
      panelClassName="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 shadow-2xs">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="create-team-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Create a new workspace
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              You will be assigned as the workspace OWNER.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close dialog"
          className="inline-flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer shrink-0"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/60 dark:border-red-900 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="leading-tight">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="team-name"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Workspace name <span aria-hidden="true" className="text-red-600">*</span>
          </label>
          <input
            ref={nameInputRef}
            id="team-name"
            type="text"
            required
            aria-required="true"
            disabled={isSubmitting}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder="e.g. Design Systems"
            maxLength={50}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "modal-name-error" : undefined}
            className={[
              "h-11 sm:h-10 w-full rounded-lg border bg-white dark:bg-slate-850 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
              "transition-all duration-150 shadow-2xs",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:border-teal-700",
              "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60",
              nameError
                ? "border-red-500 ring-2 ring-red-500/20"
                : "border-slate-300 dark:border-slate-700 hover:border-slate-400",
            ].join(" ")}
          />
          {nameError && (
            <p id="modal-name-error" role="alert" className="text-xs text-red-600 dark:text-red-400 font-medium">
              {nameError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="team-description"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Description <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(optional)</span>
          </label>
          <textarea
            id="team-description"
            rows={3}
            disabled={isSubmitting}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Workspace purpose and focus"
            maxLength={200}
            aria-describedby="team-description-hint"
            className="w-full resize-none rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 transition-all duration-150 shadow-2xs hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:border-teal-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
          />
          <p id="team-description-hint" className="text-xs text-slate-500 dark:text-slate-400">
            Maximum 200 characters.
          </p>
        </div>

        {/* Dialog Footer: Cancel left, Confirm right */}
        <div className="mt-2 flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] sm:min-h-0"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={!name.trim()}
            className="min-h-[44px] sm:min-h-0"
          >
            Create Workspace
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
