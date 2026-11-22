"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { createTeamAction } from "../actions";
import { createTeamSchema } from "../validation";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTeamModal({ isOpen, onClose }: CreateTeamModalProps) {
  const router = useRouter();
  const isSubmittingRef = useRef(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

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
      router.push(`/teams/${result.data.teamId}`);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-team-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-lg border border-[--color-border-subtle] bg-[--color-bg-surface] p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-[--color-border-subtle]">
          <h2
            id="create-team-modal-title"
            className="text-lg font-semibold text-[--color-text-primary]"
          >
            Create a new team
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded p-1 text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-[--color-border-destructive] bg-[--color-destructive-bg] px-3 py-2 text-sm text-[--color-text-destructive]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="team-name-input"
              className="text-sm font-medium text-[--color-text-secondary]"
            >
              Team name <span aria-hidden="true" className="text-[--color-priority-high]">*</span>
            </label>
            <input
              id="team-name-input"
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Engineering"
              className="h-9 w-full rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] focus:border-[--color-border-focus] focus:outline-none focus:ring-1 focus:ring-[--color-border-focus]"
            />
            {nameError && (
              <p className="text-xs text-[--color-text-destructive]">{nameError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="team-desc-input"
              className="text-sm font-medium text-[--color-text-secondary]"
            >
              Description <span className="text-xs text-[--color-text-muted]">(optional)</span>
            </label>
            <textarea
              id="team-desc-input"
              rows={3}
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team work on?"
              className="w-full rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] p-2 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] focus:border-[--color-border-focus] focus:outline-none focus:ring-1 focus:ring-[--color-border-focus]"
            />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] px-4 text-sm font-medium text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-9 items-center justify-center rounded-md bg-[--color-accent-primary] px-4 text-sm font-medium text-[--color-text-on-accent] hover:bg-[--color-accent-primary-hover] disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
