"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw, Search, X } from "lucide-react";
import type { TeamTaskAssigneeOption } from "../server";
import {
  TASK_DUE_FILTER_LABELS,
  TASK_DUE_FILTER_VALUES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_VALUES,
  TASK_SEARCH_MAX_LENGTH,
  TASK_SORT_FIELDS,
  TASK_SORT_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_VALUES,
  getDefaultTaskSortDirection,
  hasActiveTaskFilters,
  type TaskDueFilterValue,
  type TaskPriorityValue,
  type TaskQueryState,
  type TaskSortField,
  type TaskStatusValue,
} from "../validation";

interface TasksFilterToolbarProps {
  query: TaskQueryState;
  members: TeamTaskAssigneeOption[];
  onQueryChange: (patch: Partial<TaskQueryState>) => void;
  onClearFilters: () => void;
}

export function TasksFilterToolbar({
  query,
  members,
  onQueryChange,
  onClearFilters,
}: TasksFilterToolbarProps) {
  const [prevQueryQ, setPrevQueryQ] = useState(query.q ?? "");
  const [searchDraft, setSearchDraft] = useState(query.q ?? "");

  if (prevQueryQ !== (query.q ?? "")) {
    setPrevQueryQ(query.q ?? "");
    setSearchDraft(query.q ?? "");
  }

  useEffect(() => {
    const trimmed = searchDraft.trim();
    const current = query.q ?? "";
    if (trimmed === current) {
      return;
    }

    const timer = setTimeout(() => {
      onQueryChange({ q: trimmed.length > 0 ? trimmed : undefined });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchDraft, query.q, onQueryChange]);

  const filtersActive = hasActiveTaskFilters(query);

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = searchDraft.trim();
    if (trimmed !== (query.q ?? "")) {
      onQueryChange({ q: trimmed.length > 0 ? trimmed : undefined });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs min-w-0 w-full">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex-1 min-w-0 lg:max-w-sm"
          role="search"
        >
          <label htmlFor="tasks-search-input" className="sr-only">
            Search tasks or projects
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="tasks-search-input"
            type="search"
            maxLength={TASK_SEARCH_MAX_LENGTH}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search tasks or projects…"
            className="h-11 md:h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-9 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600"
          />
          {searchDraft.length > 0 ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchDraft("");
                onQueryChange({ q: undefined });
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex min-h-[44px] min-w-[44px] md:min-h-[28px] md:min-w-[28px] items-center justify-center rounded p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {query.view === "list" ? (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <select
                aria-label="Sort tasks by"
                value={query.sort}
                onChange={(event) => {
                  const nextSort = event.target.value as TaskSortField;
                  onQueryChange({
                    sort: nextSort,
                    dir: getDefaultTaskSortDirection(nextSort),
                  });
                }}
                className="h-11 md:h-9 flex-1 sm:flex-initial rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
              >
                {TASK_SORT_FIELDS.map((field) => (
                  <option key={field} value={field}>
                    Sort: {TASK_SORT_LABELS[field]}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  onQueryChange({ dir: query.dir === "asc" ? "desc" : "asc" })
                }
                className="inline-flex h-11 md:h-9 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 shrink-0"
              >
                {query.dir === "asc" ? (
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{query.dir === "asc" ? "Asc" : "Desc"}</span>
                <span className="sr-only">
                  {` (${query.dir === "asc" ? "Ascending" : "Descending"} — toggle task sort direction)`}
                </span>
              </button>
            </div>
          ) : null}

          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setSearchDraft("");
                onClearFilters();
              }}
              className="inline-flex h-11 md:h-9 items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear filters</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 min-w-0">
        <select
          aria-label="Filter by status"
          value={query.status ?? ""}
          onChange={(event) =>
            onQueryChange({
              status: (event.target.value || undefined) as
                | TaskStatusValue
                | undefined,
            })
          }
          className="h-11 md:h-9 w-full min-w-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
        >
          <option value="">All Statuses</option>
          {TASK_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {TASK_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by priority"
          value={query.priority ?? ""}
          onChange={(event) =>
            onQueryChange({
              priority: (event.target.value || undefined) as
                | TaskPriorityValue
                | undefined,
            })
          }
          className="h-11 md:h-9 w-full min-w-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
        >
          <option value="">All Priorities</option>
          {TASK_PRIORITY_VALUES.map((priority) => (
            <option key={priority} value={priority}>
              {TASK_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by assignee"
          value={query.assignee ?? ""}
          onChange={(event) =>
            onQueryChange({
              assignee: event.target.value || undefined,
            })
          }
          className="h-11 md:h-9 w-full min-w-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
        >
          <option value="">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name ?? member.email}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by due date"
          value={query.due ?? ""}
          onChange={(event) =>
            onQueryChange({
              due: (event.target.value || undefined) as
                | TaskDueFilterValue
                | undefined,
            })
          }
          className="h-11 md:h-9 w-full min-w-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700 dark:focus:ring-teal-400/30 dark:focus:border-teal-400"
        >
          <option value="">All Due Dates</option>
          {TASK_DUE_FILTER_VALUES.map((due) => (
            <option key={due} value={due}>
              {TASK_DUE_FILTER_LABELS[due]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
