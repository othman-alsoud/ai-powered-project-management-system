import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { ActivityItem } from "@/features/activity/components/activity-item";
import type { ActivityLogItemDTO } from "@/features/activity/types";

interface RecentActivityPanelProps {
  teamId: string;
  items: ActivityLogItemDTO[];
}

export function RecentActivityPanel({
  teamId,
  items,
}: RecentActivityPanelProps) {
  return (
    <section className="lg:col-span-4 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
            <History className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              Recent Activity
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
              Latest workspace updates
            </p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-500">
            <History className="h-6 w-6 text-teal-700/80 dark:text-teal-400/80" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No recent activity
          </h3>
          <p className="max-w-xs text-xs text-slate-600 dark:text-slate-400">
            Workspace changes will appear here as your team creates projects, tasks, and comments.
          </p>
        </div>
      ) : (
        <ol className="flex-1 divide-y divide-slate-100 dark:divide-slate-800/80">
          {items.map((item) => (
            <ActivityItem key={item.id} item={item} />
          ))}
        </ol>
      )}

      <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-3 bg-slate-50/50 dark:bg-slate-900/60">
        <Link
          href={`/teams/${teamId}/activity`}
          className="inline-flex min-h-[44px] md:min-h-0 items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded px-1 py-0.5"
        >
          <span>View all activity</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
