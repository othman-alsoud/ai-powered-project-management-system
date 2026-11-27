"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { Building2, ArrowRight, AlertCircle } from "lucide-react";
import { createTeamAction } from "../actions";
import { createTeamSchema } from "../validation";
import { publishTeamSyncEvent } from "../lib/team-sync";
import { TeamContextSync } from "./team-context-sync";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TeamsOnboardingProps {
  userId: string;
  userName: string;
}

export function TeamsOnboarding({ userId, userName }: TeamsOnboardingProps) {
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

      publishTeamSyncEvent({
        type: "TEAM_CREATED",
        userId,
        teamId: result.data.teamId,
      });
      router.push(`/teams/${result.data.teamId}`);
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
      className="relative flex min-h-screen flex-1 flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 overflow-hidden"
    >
      <TeamContextSync currentUserId={userId} />
      {/* Ambient background decoration */}
      <div
        aria-hidden="true"
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[360px] bg-teal-500/10 dark:bg-teal-500/5 blur-[120px] rounded-full pointer-events-none"
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 shadow-xl backdrop-blur-xs">
        {/* Step pill & Icon */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400 border border-teal-200/80 dark:border-teal-800 shadow-xs">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant="teal" size="sm" dot>
                Step 1 of 1 &bull; Initial Setup
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Welcome, {userName}!
            </h1>
          </div>
        </div>

        <p className="mt-3.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          To begin tracking projects, managing tasks, and collaborating with teammates, create your primary workspace. You will be assigned as the workspace{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-200">OWNER</span>.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:bg-red-950/60 dark:border-red-900 dark:text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="onboarding-team-name"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Workspace name <span aria-hidden="true" className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="onboarding-team-name"
              type="text"
              required
              aria-required="true"
              disabled={isSubmitting}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="e.g. Acme Engineering or Product Studio"
              maxLength={50}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "onboarding-name-error" : "onboarding-name-hint"}
              className={[
                "h-10 w-full rounded-lg border bg-white dark:bg-slate-850 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                "transition-all duration-150 shadow-2xs",
                "focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700 dark:focus:ring-teal-400/25 dark:focus:border-teal-400",
                "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60",
                nameError
                  ? "border-red-500 ring-2 ring-red-500/20"
                  : "border-slate-300 dark:border-slate-700 hover:border-slate-400",
              ].join(" ")}
            />
            {nameError ? (
              <p id="onboarding-name-error" role="alert" className="text-xs text-red-600 dark:text-red-400 font-medium">
                {nameError}
              </p>
            ) : (
              <p id="onboarding-name-hint" className="text-xs text-slate-600 dark:text-slate-400">
                Between 1 and 50 characters. Usually your team, project, or company name.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="onboarding-team-desc"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Description <span className="text-xs font-normal text-slate-600 dark:text-slate-400">(optional)</span>
            </label>
            <textarea
              id="onboarding-team-desc"
              rows={3}
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team build or deliver?"
              maxLength={200}
              aria-describedby="onboarding-desc-hint"
              className="w-full resize-none rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 transition-all duration-150 shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700 dark:focus:ring-teal-400/25 dark:focus:border-teal-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
            />
            <p id="onboarding-desc-hint" className="text-[11px] text-slate-600 dark:text-slate-400">
              Maximum 200 characters.
            </p>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-2 w-full"
            isLoading={isSubmitting}
            disabled={!name.trim()}
            rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            Create Team Workspace
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 text-center">
          <Link
            href="/account"
            className="inline-flex min-h-[44px] md:min-h-0 items-center text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-sm px-1 transition-colors"
          >
            Account settings &amp; deletion
          </Link>
        </div>
      </div>
    </main>
  );
}
