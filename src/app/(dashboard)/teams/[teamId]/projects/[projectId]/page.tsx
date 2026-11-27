import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  Clock,
  History,
  User as UserIcon,
} from "lucide-react";
import { ActivityTimeline } from "@/features/activity/components/activity-timeline";
import { getProjectActivity } from "@/features/activity/server";
import {
  parseActivitySearchParams,
  parseProjectDetailTab,
} from "@/features/activity/validation";
import { requireTeamMember } from "@/features/teams/server";
import { getProjectById } from "@/features/projects/server";
import { formatUtcDateLabel } from "@/features/projects/date-utils";
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge";
import { ProjectDetailActions } from "@/features/projects/components/project-detail-actions";
import {
  getTaskFormOptions,
  getTeamTasksPageResult,
} from "@/features/tasks/server";
import { parseTaskQueryParams } from "@/features/tasks/validation";
import { TasksManager } from "@/features/tasks/components/tasks-manager";
import { Card } from "@/components/ui/card";

export const instant = false;

interface ProjectDetailPageProps {
  params: Promise<{ teamId: string; projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectDetailPage(props: ProjectDetailPageProps) {
  const [{ teamId, projectId }, resolvedSearchParams] = await Promise.all([
    props.params,
    props.searchParams ?? Promise.resolve({}),
  ]);
  const query = parseTaskQueryParams(resolvedSearchParams);
  const activeTab = parseProjectDetailTab(resolvedSearchParams);
  const activityQuery = parseActivitySearchParams(resolvedSearchParams);
  const { user, role } = await requireTeamMember(teamId);
  const project = await getProjectById(projectId, teamId);

  if (!project) {
    notFound();
  }

  const canManageTasks = role === "OWNER" || role === "MANAGER";
  const [taskPageResult, taskOptions, projectActivityPage] =
    activeTab === "activity"
      ? [
          null,
          null,
          await getProjectActivity(teamId, project.id, activityQuery),
        ]
      : [
          ...(await Promise.all([
            getTeamTasksPageResult(teamId, query, { projectId: project.id }),
            canManageTasks
              ? getTaskFormOptions(teamId)
              : getTaskFormOptions(teamId, { includeProjects: false }),
          ])),
          null,
        ];

  const effectiveQuery =
    taskPageResult && taskPageResult.page !== query.page
      ? { ...query, page: taskPageResult.page }
      : query;

  const startLabel = formatUtcDateLabel(project.startDate);
  const endLabel = formatUtcDateLabel(project.endDate);
  const createdLabel = formatUtcDateLabel(project.createdAt);
  const updatedLabel = formatUtcDateLabel(project.updatedAt);

  return (
    <main
      id="main-content"
      className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950 min-w-0"
    >
      <div className="mx-auto max-w-5xl flex flex-col gap-6">
        <div>
          <Link
            href={`/teams/${teamId}/projects`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Projects</span>
          </Link>
        </div>

        {/* Project Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Project
              </span>
              <span className="text-xs text-slate-400">/</span>
              <ProjectStatusBadge status={project.status} size="md" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 break-words">
              {project.name}
            </h1>
            {project.description ? (
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-w-3xl leading-relaxed">
                {project.description}
              </p>
            ) : (
              <p className="text-xs italic text-slate-400 dark:text-slate-500">
                No project description provided.
              </p>
            )}
          </div>

          <div className="shrink-0">
            <ProjectDetailActions
              teamId={teamId}
              project={project}
              currentUserRole={role}
            />
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Start Date
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {startLabel ?? "Not set"}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Target End Date
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {endLabel ?? "Not set"}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <UserIcon className="h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Created By
                </p>
                <p className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {project.createdBy.name}
                </p>
                {createdLabel && (
                  <p className="text-[11px] text-slate-400">{createdLabel}</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <CheckSquare className="h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active Tasks
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                  {project.taskCount}
                </p>
                {project.updatedBy && updatedLabel && (
                  <p className="truncate text-[11px] text-slate-400">
                    Updated by {project.updatedBy.name}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Project Sections: Tasks | Activity (DESIGN_GUIDELINES.md §8.2) */}
        <nav
          aria-label="Project sections"
          className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800"
        >
          <Link
            href={`/teams/${teamId}/projects/${project.id}`}
            aria-current={activeTab === "tasks" ? "page" : undefined}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors min-h-[44px] sm:min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              activeTab === "tasks"
                ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <CheckSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Tasks</span>
          </Link>
          <Link
            href={`/teams/${teamId}/projects/${project.id}?tab=activity`}
            aria-current={activeTab === "activity" ? "page" : undefined}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors min-h-[44px] sm:min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              activeTab === "activity"
                ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <History className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Activity</span>
          </Link>
        </nav>

        {activeTab === "activity" ? (
          <ActivityTimeline
            teamId={teamId}
            initialPage={
              projectActivityPage ?? {
                items: [],
                nextCursor: null,
                hasMore: false,
              }
            }
            initialAction={activityQuery.action}
            initialLimit={activityQuery.limit}
            scopedProjectId={project.id}
          />
        ) : (
          <TasksManager
            teamId={teamId}
            tasks={taskPageResult!.tasks}
            projects={taskOptions!.projects}
            members={taskOptions!.members}
            currentUserId={user.id}
            currentUserRole={role}
            scopedProjectId={project.id}
            initialView={effectiveQuery.view}
            query={effectiveQuery}
            totalCount={taskPageResult!.totalCount}
            totalPages={taskPageResult!.totalPages}
            pageSize={taskPageResult!.pageSize}
          />
        )}
      </div>
    </main>
  );
}
