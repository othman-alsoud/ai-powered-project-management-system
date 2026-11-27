import { requireTeamMember } from "@/features/teams/server";
import { parseTaskQueryParams } from "@/features/tasks/validation";
import {
  getTaskFormOptions,
  getTeamTasksPageResult,
} from "@/features/tasks/server";
import { TasksManager } from "@/features/tasks/components/tasks-manager";

export const instant = false;

interface TeamTasksPageProps {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TeamTasksPage(props: TeamTasksPageProps) {
  const [{ teamId }, resolvedSearchParams] = await Promise.all([
    props.params,
    props.searchParams ?? Promise.resolve({}),
  ]);
  const query = parseTaskQueryParams(resolvedSearchParams);

  const { user, role } = await requireTeamMember(teamId);
  const canManageTasks = role === "OWNER" || role === "MANAGER";
  const [taskPageResult, options] = await Promise.all([
    getTeamTasksPageResult(teamId, query),
    canManageTasks
      ? getTaskFormOptions(teamId)
      : getTaskFormOptions(teamId, { includeProjects: false }),
  ]);

  const effectiveQuery =
    taskPageResult.page !== query.page
      ? { ...query, page: taskPageResult.page }
      : query;

  return (
    <main
      id="main-content"
      className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950 min-w-0"
    >
      <div className="mx-auto max-w-7xl">
        <TasksManager
          teamId={teamId}
          tasks={taskPageResult.tasks}
          projects={options.projects}
          members={options.members}
          currentUserId={user.id}
          currentUserRole={role}
          initialView={effectiveQuery.view}
          query={effectiveQuery}
          totalCount={taskPageResult.totalCount}
          totalPages={taskPageResult.totalPages}
          pageSize={taskPageResult.pageSize}
        />
      </div>
    </main>
  );
}
