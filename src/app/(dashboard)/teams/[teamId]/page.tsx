import { Badge } from "@/components/ui/badge";
import { DashboardDistribution } from "@/features/dashboard/components/dashboard-distribution";
import { DashboardHeaderActions } from "@/features/dashboard/components/dashboard-header-actions";
import { DashboardMetricsRow } from "@/features/dashboard/components/dashboard-metrics-row";
import { PrioritizedTaskStream } from "@/features/dashboard/components/prioritized-task-stream";
import { RecentActivityPanel } from "@/features/dashboard/components/recent-activity-panel";
import { getTeamDashboardData } from "@/features/dashboard/server";

export const instant = false;

interface TeamDashboardPageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamDashboardPage(props: TeamDashboardPageProps) {
  const { teamId } = await props.params;
  const dashboard = await getTeamDashboardData(teamId);

  return (
    <main
      id="main-content"
      className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950 min-w-0 pb-24 md:pb-8"
    >
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        {/* Page Header (docs/DESIGN_GUIDELINES.md §7.1) */}
        <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Workspace
              </span>
              <span className="text-xs text-slate-400">/</span>
              <Badge variant="teal" size="sm">
                {dashboard.role}
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {`Dashboard / ${dashboard.team.name}`}
            </h1>
            {dashboard.team.description ? (
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                {dashboard.team.description}
              </p>
            ) : null}
          </div>

          <DashboardHeaderActions
            teamId={dashboard.team.id}
            role={dashboard.role}
            taskFormOptions={dashboard.taskFormOptions}
          />
        </div>

        {/* 4 Stat Metrics Row (docs/DESIGN_GUIDELINES.md §7.2) */}
        <DashboardMetricsRow
          teamId={dashboard.team.id}
          currentUserId={dashboard.currentUser.id}
          metrics={dashboard.metrics}
        />

        {/* Status Distribution & Priority Breakdown (REQ-DASH-01) */}
        <DashboardDistribution
          statusBreakdown={dashboard.statusBreakdown}
          totalTasksCount={dashboard.totalTasksCount}
          priorityBreakdown={dashboard.priorityBreakdown}
          totalOpenTasksCount={dashboard.totalOpenTasksCount}
        />

        {/* Main Two-Column Content Grid (docs/DESIGN_GUIDELINES.md §7.3 & §7.4) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <PrioritizedTaskStream
            teamId={dashboard.team.id}
            tasks={dashboard.prioritizedTasks}
            referenceDate={dashboard.referenceDate}
          />
          <RecentActivityPanel
            teamId={dashboard.team.id}
            items={dashboard.recentActivity}
          />
        </div>
      </div>
    </main>
  );
}
