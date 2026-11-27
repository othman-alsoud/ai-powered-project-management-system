import Link from "next/link";
import {
  CalendarDays,
  CheckSquare,
  Clock,
  FolderKanban,
} from "lucide-react";
import type { TeamDashboardMetrics } from "../server";

interface DashboardMetricsRowProps {
  teamId: string;
  currentUserId: string;
  metrics: TeamDashboardMetrics;
}

export function DashboardMetricsRow({
  teamId,
  currentUserId,
  metrics,
}: DashboardMetricsRowProps) {
  const items = [
    {
      key: "active-projects",
      label: "Active Projects",
      value: metrics.activeProjectsCount,
      hint: `of ${metrics.totalProjectsCount} total`,
      href: `/teams/${teamId}/projects`,
      icon: FolderKanban,
      accentClass: "text-sky-600 dark:text-sky-400",
    },
    {
      key: "my-tasks",
      label: "My Tasks",
      value: metrics.myTasksCount,
      hint: "Open assigned to you",
      href: `/teams/${teamId}/tasks?assignee=${encodeURIComponent(currentUserId)}`,
      icon: CheckSquare,
      accentClass: "text-teal-600 dark:text-teal-400",
    },
    {
      key: "in-review",
      label: "In Review",
      value: metrics.inReviewCount,
      hint: "Pending review",
      href: `/teams/${teamId}/tasks?status=IN_REVIEW`,
      icon: Clock,
      accentClass: "text-violet-600 dark:text-violet-400",
    },
    {
      key: "due-this-week",
      label: "Due This Week",
      value: metrics.dueThisWeekCount,
      hint: "UTC week (non-done)",
      href: `/teams/${teamId}/tasks?due=this_week`,
      icon: CalendarDays,
      accentClass: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <section aria-label="Workspace metrics">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {items.map((item, index) => {
          const Icon = item.icon;
          const borderClasses = [
            index < 3 ? "border-b" : "",
            index < 2 ? "sm:border-b" : "sm:border-b-0",
            index % 2 === 0 ? "sm:border-r" : "sm:border-r-0",
            "lg:border-b-0",
            index < 3 ? "lg:border-r" : "lg:border-r-0",
            "border-slate-200 dark:border-slate-800",
          ]
            .filter(Boolean)
            .join(" ");

          return (
              <Link
                key={item.key}
                href={item.href}
                className={`group flex flex-col justify-between p-5 transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 ${borderClasses}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                    {item.label}
                  </span>
                  <Icon
                    className={`h-4 w-4 shrink-0 ${item.accentClass}`}
                    aria-hidden="true"
                  />
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <p className="font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                    {item.value}
                  </p>
                  <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {item.hint}
                  </span>
                </div>
              </Link>
          );
        })}
      </div>
    </section>
  );
}
