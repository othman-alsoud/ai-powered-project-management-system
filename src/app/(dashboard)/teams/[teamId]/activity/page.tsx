import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/features/activity/components/activity-timeline";
import { getTeamActivity } from "@/features/activity/server";
import { parseActivitySearchParams } from "@/features/activity/validation";
import { getTeamProjectOptions } from "@/features/projects/server";
import { requireTeamMember } from "@/features/teams/server";

export const instant = false;

interface TeamActivityPageProps {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TeamActivityPage(props: TeamActivityPageProps) {
  const [{ teamId }, resolvedSearchParams] = await Promise.all([
    props.params,
    props.searchParams ?? Promise.resolve({}),
  ]);

  const { team, role } = await requireTeamMember(teamId);
  const query = parseActivitySearchParams(resolvedSearchParams);

  const [initialPage, projects] = await Promise.all([
    getTeamActivity(teamId, query),
    getTeamProjectOptions(teamId),
  ]);

  return (
    <main
      id="main-content"
      className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950 min-w-0"
    >
      <div className="mx-auto max-w-5xl flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Workspace
            </span>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Activity
            </span>
            <span className="text-xs text-slate-400">/</span>
            <Badge variant="teal" size="sm">
              {role}
            </Badge>
          </div>
          <div className="flex items-center gap-2.5">
            <History
              className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0"
              aria-hidden="true"
            />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Team Activity
            </h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Chronological audit stream of project, task, comment, and membership changes in{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {team.name}
            </span>
            .
          </p>
        </div>

        {/* Interactive Activity Timeline */}
        <ActivityTimeline
          teamId={teamId}
          initialPage={initialPage}
          initialAction={query.action}
          initialProjectId={query.projectId}
          initialLimit={query.limit}
          projects={projects}
        />
      </div>
    </main>
  );
}
