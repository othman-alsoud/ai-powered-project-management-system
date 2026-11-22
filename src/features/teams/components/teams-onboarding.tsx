"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { createTeamAction } from "../actions";
import { createTeamSchema } from "../validation";

interface TeamsOnboardingProps {
  userName: string;
}

export function TeamsOnboarding({ userName }: TeamsOnboardingProps) {
  const router = useRouter();
  const isSubmittingRef = useRef(false);

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
    <main
      id="main-content"
      className="flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-16"
    >
      <div className="w-full max-w-md rounded-lg border border-[--color-border-subtle] bg-[--color-bg-surface] p-8 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[--color-accent-primary]/15 text-[--color-accent-primary]">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>

        <h1 className="mt-4 text-xl font-bold tracking-tight text-[--color-text-primary]">
          Welcome, {userName}!
        </h1>
        <p className="mt-1 text-sm text-[--color-text-secondary]">
          To get started with project management, create your first team workspace.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-[--color-border-destructive] bg-[--color-destructive-bg] px-3 py-2 text-sm text-[--color-text-destructive]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="onboarding-team-name"
              className="text-sm font-medium text-[--color-text-secondary]"
            >
              Team name <span aria-hidden="true" className="text-[--color-priority-high]">*</span>
            </label>
            <input
              id="onboarding-team-name"
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Studio, Product Team"
              className="h-10 w-full rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] focus:border-[--color-border-focus] focus:outline-none focus:ring-1 focus:ring-[--color-border-focus]"
            />
            {nameError && (
              <p className="text-xs text-[--color-text-destructive]">{nameError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="onboarding-team-desc"
              className="text-sm font-medium text-[--color-text-secondary]"
            >
              Description <span className="text-xs text-[--color-text-muted]">(optional)</span>
            </label>
            <textarea
              id="onboarding-team-desc"
              rows={3}
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does your team focus on?"
              className="w-full rounded-md border border-[--color-border-subtle] bg-[--color-bg-surface] p-2.5 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] focus:border-[--color-border-focus] focus:outline-none focus:ring-1 focus:ring-[--color-border-focus]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-[--color-accent-primary] px-4 text-sm font-medium text-[--color-text-on-accent] transition-colors hover:bg-[--color-accent-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent-primary] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creating workspace...
              </span>
            ) : (
              "Create Workspace & Continue"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
