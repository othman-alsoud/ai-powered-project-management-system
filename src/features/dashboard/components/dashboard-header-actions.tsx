"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FolderKanban, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/features/tasks/components/task-form-dialog";
import type { TeamRole } from "@/generated/prisma/client";
import type { TeamDashboardTaskFormOptions } from "../server";

interface DashboardHeaderActionsProps {
  teamId: string;
  role: TeamRole;
  taskFormOptions: TeamDashboardTaskFormOptions | null;
}

export function DashboardHeaderActions({
  teamId,
  role,
  taskFormOptions,
}: DashboardHeaderActionsProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  if (role !== "OWNER" && role !== "MANAGER") {
    return null;
  }

  const projects = taskFormOptions?.projects ?? [];
  const members = taskFormOptions?.members ?? [];
  const hasProjects = projects.length > 0;

  function handleSuccess(message: string) {
    setIsCreateOpen(false);
    setToastMessage(message);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setToastMessage(null);
    }, 4500);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {toastMessage ? (
          <div
            role="status"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              aria-label="Dismiss notification"
              className="inline-flex min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 items-center justify-center rounded p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {hasProjects ? (
          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
            <span>New Task</span>
          </Button>
        ) : (
          <Link
            href={`/teams/${teamId}/projects`}
            className="inline-flex h-11 md:h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 shrink-0"
          >
            <FolderKanban className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <span>Create a Project First</span>
          </Link>
        )}
      </div>

      {/* Mobile Floating Action Button (DESIGN_GUIDELINES.md §7.6) */}
      {hasProjects ? (
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          aria-label="New Task"
          className="fixed bottom-6 right-4 z-30 inline-flex h-12 items-center gap-1.5 rounded-full bg-teal-700 px-4 text-sm font-medium text-white shadow-md hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 md:hidden transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New Task</span>
        </button>
      ) : null}

      {hasProjects ? (
        <TaskFormDialog
          isOpen={isCreateOpen}
          mode="create"
          teamId={teamId}
          projects={projects}
          members={members}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={handleSuccess}
        />
      ) : null}
    </>
  );
}
