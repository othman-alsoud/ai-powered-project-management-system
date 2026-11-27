import Link from "next/link";
import { ArrowRight, FolderKanban, Inbox, ListTodo, User as UserIcon } from "lucide-react";
import { TaskDueDate } from "@/features/tasks/components/task-due-date";
import { TaskPriorityBadge } from "@/features/tasks/components/task-priority-badge";
import { TaskStatusBadge } from "@/features/tasks/components/task-status-badge";
import type { DashboardTaskItem } from "../utils";

interface PrioritizedTaskStreamProps {
  teamId: string;
  tasks: DashboardTaskItem[];
  referenceDate: Date;
}

function getInitial(name: string | null): string {
  const trimmed = name?.trim() ?? "";
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export function PrioritizedTaskStream({
  teamId,
  tasks,
  referenceDate,
}: PrioritizedTaskStreamProps) {
  return (
    <section className="lg:col-span-8 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
            <ListTodo className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              Prioritized Task Stream
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
              Top open deliverables sorted by overdue status, due date, and priority
            </p>
          </div>
        </div>

        <Link
          href={`/teams/${teamId}/tasks`}
          className="inline-flex min-h-[44px] md:min-h-0 items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded px-1.5 py-1"
        >
          <span>View all</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-500">
            <Inbox className="h-6 w-6 text-teal-700/80 dark:text-teal-400/80" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No open tasks
          </h3>
          <p className="max-w-sm text-xs text-slate-600 dark:text-slate-400">
            All open deliverables are completed or no tasks have been created yet.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop / Tablet Dense Table (§7.3) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <th scope="col" className="py-2.5 pl-5 pr-3">
                    Task
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Status
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Project
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Priority
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Due Date
                  </th>
                  <th scope="col" className="py-2.5 pl-3 pr-5">
                    Assignee
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-800/30 transition-colors duration-100"
                  >
                    <td className="py-3 pl-5 pr-3 max-w-[260px]">
                      <Link
                        href={`/teams/${teamId}/projects/${task.projectId}`}
                        className="font-medium text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 truncate block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <TaskStatusBadge status={task.status} />
                    </td>
                    <td className="py-3 px-3 max-w-[160px]">
                      <Link
                        href={`/teams/${teamId}/projects/${task.projectId}`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors max-w-full"
                      >
                        <FolderKanban className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{task.project.name}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <TaskPriorityBadge priority={task.priority} />
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <TaskDueDate
                        dueDate={task.dueDate}
                        status={task.status}
                        referenceDate={referenceDate}
                      />
                    </td>
                    <td className="py-3 pl-3 pr-5 whitespace-nowrap">
                      {task.assignee ? (
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/70 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
                          >
                            {getInitial(task.assignee.name)}
                          </span>
                          <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                            {task.assignee.name ?? "Member"}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                          <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Unassigned</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-per-Task List (§7.6) */}
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
            {tasks.map((task) => (
              <li key={task.id} className="p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/teams/${teamId}/projects/${task.projectId}`}
                    className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-sm line-clamp-2"
                  >
                    {task.title}
                  </Link>
                  <TaskPriorityBadge priority={task.priority} className="shrink-0" />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <TaskStatusBadge status={task.status} />
                  <Link
                    href={`/teams/${teamId}/projects/${task.projectId}`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    <FolderKanban className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate max-w-[160px]">{task.project.name}</span>
                  </Link>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <TaskDueDate
                    dueDate={task.dueDate}
                    status={task.status}
                    referenceDate={referenceDate}
                  />
                  <span className="text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                    {task.assignee?.name ?? "Unassigned"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
