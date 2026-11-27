import type { TaskPriorityValue, TaskStatusValue } from "@/features/tasks/validation";
import type { DashboardPriorityItem, DashboardStatusItem } from "../utils";

interface DashboardDistributionProps {
  statusBreakdown: DashboardStatusItem[];
  totalTasksCount: number;
  priorityBreakdown: DashboardPriorityItem[];
  totalOpenTasksCount: number;
}

const STATUS_BAR_COLOR: Record<TaskStatusValue, string> = {
  TODO: "bg-slate-400 dark:bg-slate-500",
  IN_PROGRESS: "bg-sky-500 dark:bg-sky-400",
  IN_REVIEW: "bg-violet-500 dark:bg-violet-400",
  DONE: "bg-emerald-500 dark:bg-emerald-400",
};

const PRIORITY_BAR_COLOR: Record<TaskPriorityValue, string> = {
  HIGH: "bg-rose-500 dark:bg-rose-400",
  MEDIUM: "bg-amber-500 dark:bg-amber-400",
  LOW: "bg-slate-400 dark:bg-slate-500",
};

export function DashboardDistribution({
  statusBreakdown,
  totalTasksCount,
  priorityBreakdown,
  totalOpenTasksCount,
}: DashboardDistributionProps) {
  return (
    <section
      aria-label="Task breakdown by status and priority"
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      {/* Status Distribution */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Status Distribution
          </h2>
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {`${totalTasksCount} total`}
          </span>
        </div>

        <div
          className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="img"
          aria-label={`Task status distribution across ${totalTasksCount} tasks`}
        >
          {totalTasksCount > 0
            ? statusBreakdown.map((item) =>
                item.count > 0 ? (
                  <div
                    key={item.status}
                    style={{ width: `${(item.count / totalTasksCount) * 100}%` }}
                    className={`${STATUS_BAR_COLOR[item.status]} transition-all`}
                    title={`${item.label}: ${item.count} (${item.percentage}%)`}
                  />
                ) : null,
              )
            : null}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {statusBreakdown.map((item) => (
            <div key={item.status} className="flex flex-col gap-0.5 min-w-0">
              <dt className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 truncate">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${STATUS_BAR_COLOR[item.status]}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </dt>
              <dd className="font-mono text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                {item.count}{" "}
                <span className="text-slate-600 dark:text-slate-400">
                  ({item.percentage}%)
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Priority Breakdown (Open Tasks Only) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Priority Breakdown
          </h2>
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {`${totalOpenTasksCount} open`}
          </span>
        </div>

        <div
          className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="img"
          aria-label={`Open task priority breakdown across ${totalOpenTasksCount} open tasks`}
        >
          {totalOpenTasksCount > 0
            ? priorityBreakdown.map((item) =>
                item.count > 0 ? (
                  <div
                    key={item.priority}
                    style={{ width: `${(item.count / totalOpenTasksCount) * 100}%` }}
                    className={`${PRIORITY_BAR_COLOR[item.priority]} transition-all`}
                    title={`${item.label}: ${item.count} (${item.percentage}%)`}
                  />
                ) : null,
              )
            : null}
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-2">
          {priorityBreakdown.map((item) => (
            <div key={item.priority} className="flex flex-col gap-0.5 min-w-0">
              <dt className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 truncate">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_BAR_COLOR[item.priority]}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </dt>
              <dd className="font-mono text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                {item.count}{" "}
                <span className="text-slate-600 dark:text-slate-400">
                  ({item.percentage}%)
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
