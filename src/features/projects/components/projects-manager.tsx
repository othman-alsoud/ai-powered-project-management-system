"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  FolderKanban,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { TeamRole } from "@/features/teams/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUtcDateLabel } from "../date-utils";
import type { ProjectSummary } from "../server";
import {
  PROJECT_SORT_FIELDS,
  PROJECT_SORT_LABELS,
  type ProjectQueryParams,
  type ProjectSortField,
} from "../validation";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { ProjectFormDialog } from "./project-form-dialog";
import { ProjectStatusBadge } from "./project-status-badge";

export function buildProjectsQueryUrl(
  pathname: string,
  search: string,
  nextQuery: ProjectQueryParams,
): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (nextQuery.sort !== "createdAt" || nextQuery.dir !== "desc") {
    params.set("sort", nextQuery.sort);
    params.set("dir", nextQuery.dir);
  } else {
    params.delete("sort");
    params.delete("dir");
  }
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

interface ProjectsManagerProps {
  teamId: string;
  projects: ProjectSummary[];
  currentUserRole: TeamRole;
  query?: ProjectQueryParams;
}

export function clearToastTimer(timeoutRef: {
  current: ReturnType<typeof setTimeout> | null;
}): void {
  if (timeoutRef.current !== null) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

export function scheduleToastTimer(
  timeoutRef: { current: ReturnType<typeof setTimeout> | null },
  setMessage: (msg: string | null) => void,
  message: string,
  durationMs: number = 4000
): void {
  clearToastTimer(timeoutRef);
  setMessage(message);

  const timerId = setTimeout(() => {
    if (timeoutRef.current === timerId) {
      timeoutRef.current = null;
      setMessage(null);
    }
  }, durationMs);

  timeoutRef.current = timerId;
}

function formatTimeline(startDate: Date | null, endDate: Date | null): string {
  const start = formatUtcDateLabel(startDate);
  const end = formatUtcDateLabel(endDate);
  if (start && end) {
    return start === end ? start : `${start} – ${end}`;
  }
  if (end) return `Due ${end}`;
  if (start) return `Starts ${start}`;
  return "No dates set";
}

export function ProjectsManager({
  teamId,
  projects,
  currentUserRole,
  query = { sort: "createdAt", dir: "desc" },
}: ProjectsManagerProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(
    null
  );
  const [deletingProject, setDeletingProject] = useState<ProjectSummary | null>(
    null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => clearToastTimer(toastTimeoutRef);
  }, []);

  const canManage = currentUserRole === "OWNER" || currentUserRole === "MANAGER";

  const showToast = (msg: string) => {
    scheduleToastTimer(toastTimeoutRef, setSuccessMessage, msg, 4000);
  };

  function handleSortChange(nextQuery: ProjectQueryParams) {
    if (typeof window !== "undefined") {
      const nextUrl = buildProjectsQueryUrl(
        window.location.pathname,
        window.location.search,
        nextQuery,
      );
      router.push(nextUrl, { scroll: false });
    }
  }

  function handleColumnSort(field: ProjectSortField) {
    const defaultDir = field === "name" || field === "endDate" ? "asc" : "desc";
    const nextDir =
      query.sort === field
        ? query.dir === "asc"
          ? "desc"
          : "asc"
        : defaultDir;
    handleSortChange({ sort: field, dir: nextDir });
  }

  function renderSortIcon(field: ProjectSortField) {
    if (query.sort !== field) {
      return (
        <ArrowUpDown
          className="h-3.5 w-3.5 text-slate-400 shrink-0"
          aria-hidden="true"
        />
      );
    }
    return query.dir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Workspace
            </span>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Projects
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Projects
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {projects.length === 1
              ? "1 active project in this workspace."
              : `${projects.length} active projects in this workspace.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Sort projects by"
              value={query.sort}
              onChange={(event) => {
                const nextSort = event.target.value as ProjectSortField;
                handleSortChange({
                  sort: nextSort,
                  dir:
                    nextSort === "name" || nextSort === "endDate"
                      ? "asc"
                      : "desc",
                });
              }}
              className="h-11 md:h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
            >
              {PROJECT_SORT_FIELDS.map((field) => (
                <option key={field} value={field}>
                  Sort: {PROJECT_SORT_LABELS[field]}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                handleSortChange({
                  sort: query.sort,
                  dir: query.dir === "asc" ? "desc" : "asc",
                })
              }
              className="inline-flex h-11 md:h-9 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400"
            >
              {query.dir === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{query.dir === "asc" ? "Asc" : "Desc"}</span>
              <span className="sr-only">
                {` (${query.dir === "asc" ? "Ascending" : "Descending"} — toggle project sort direction)`}
              </span>
            </button>
          </div>

          {canManage && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New Project
            </Button>
          )}
        </div>
      </div>

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
        >
          {successMessage}
        </div>
      )}

      {/* Empty State (§19.2) */}
      {projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/80 dark:border-teal-800/80">
            <FolderKanban className="h-6 w-6" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No projects yet
          </h2>
          <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
            {canManage
              ? "Create a project to organize deliverables, track status, and set target dates."
              : "A workspace owner or manager has not created any projects yet."}
          </p>
          {canManage && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="mt-1"
              onClick={() => setCreateOpen(true)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Create Project
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* Desktop Table (lg and up) */}
          <div className="hidden lg:block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th
                      scope="col"
                      aria-sort={
                        query.sort === "name"
                          ? query.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                    >
                      <button
                        type="button"
                        onClick={() => handleColumnSort("name")}
                        className={`inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded ${
                          query.sort === "name"
                            ? "font-bold text-slate-900 dark:text-slate-100"
                            : ""
                        }`}
                      >
                        <span>Project</span>
                        {renderSortIcon("name")}
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                    >
                      Tasks
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        query.sort === "endDate"
                          ? query.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                    >
                      <button
                        type="button"
                        onClick={() => handleColumnSort("endDate")}
                        className={`inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded ${
                          query.sort === "endDate"
                            ? "font-bold text-slate-900 dark:text-slate-100"
                            : ""
                        }`}
                      >
                        <span>Timeline</span>
                        {renderSortIcon("endDate")}
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                    >
                      Created By
                    </th>
                    {canManage && (
                      <th
                        scope="col"
                        className="px-5 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors duration-100"
                    >
                      <td className="px-5 py-3.5 max-w-[280px]">
                        <Link
                          href={`/teams/${teamId}/projects/${project.id}`}
                          className="block truncate font-medium text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <ProjectStatusBadge status={project.status} />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                        {project.taskCount}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        {formatTimeline(project.startDate, project.endDate)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        {project.createdBy.name}
                      </td>
                      {canManage && (
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit project ${project.name}`}
                              onClick={() => setEditingProject(project)}
                              leftIcon={<Pencil className="h-3.5 w-3.5" />}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete project ${project.name}`}
                              onClick={() => setDeletingProject(project)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tablet & Mobile Card List (< lg) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {projects.map((project) => (
              <Card key={project.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/teams/${teamId}/projects/${project.id}`}
                    className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 transition-colors break-words"
                  >
                    {project.name}
                  </Link>
                  <ProjectStatusBadge status={project.status} />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatTimeline(project.startDate, project.endDate)}</span>
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                    {project.taskCount} {project.taskCount === 1 ? "task" : "tasks"}
                  </span>
                  <span>By {project.createdBy.name}</span>
                </div>

                {canManage && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Edit project ${project.name}`}
                      onClick={() => setEditingProject(project)}
                      leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Delete project ${project.name}`}
                      onClick={() => setDeletingProject(project)}
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/50"
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dialogs */}
      {canManage && (
        <>
          <ProjectFormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            teamId={teamId}
            mode="create"
            onSuccess={showToast}
          />
          <ProjectFormDialog
            open={Boolean(editingProject)}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) setEditingProject(null);
            }}
            teamId={teamId}
            mode="edit"
            project={editingProject}
            onSuccess={showToast}
          />
          <DeleteProjectDialog
            open={Boolean(deletingProject)}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) setDeletingProject(null);
            }}
            teamId={teamId}
            project={deletingProject}
            onDeleted={() => showToast("Project deleted successfully.")}
          />
        </>
      )}
    </div>
  );
}
