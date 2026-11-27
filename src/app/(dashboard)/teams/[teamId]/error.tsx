"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeamDashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TeamDashboardError({
  reset,
}: TeamDashboardErrorProps) {
  return (
    <main
      id="main-content"
      className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950 min-w-0"
    >
      <div className="mx-auto max-w-3xl">
        <div
          role="alert"
          className="rounded-xl border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-slate-900 p-8 text-center flex flex-col items-center gap-3"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Unable to load team dashboard
          </h1>
          <p className="max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Something went wrong while fetching your workspace summary. Please try again.
          </p>
          <Button type="button" onClick={reset} className="mt-2">
            <RotateCcw className="h-4 w-4 mr-1.5" aria-hidden="true" />
            <span>Try again</span>
          </Button>
        </div>
      </div>
    </main>
  );
}
