import React from "react";
import Link from "next/link";
import { createRoot } from "react-dom/client";
import { ArrowLeft, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceSidebar } from "@/features/teams/components/sidebar";
import { TeamMembersManager } from "@/features/teams/components/team-members-manager";
import { TeamsOnboarding } from "@/features/teams/components/teams-onboarding";
import { ProjectsManager } from "@/features/projects/components/projects-manager";
import { TasksManager } from "@/features/tasks/components/tasks-manager";
import { DashboardHeaderActions } from "@/features/dashboard/components/dashboard-header-actions";
import { DashboardMetricsRow } from "@/features/dashboard/components/dashboard-metrics-row";
import { DashboardDistribution } from "@/features/dashboard/components/dashboard-distribution";
import { PrioritizedTaskStream } from "@/features/dashboard/components/prioritized-task-stream";
import { RecentActivityPanel } from "@/features/dashboard/components/recent-activity-panel";
import { ActivityTimeline } from "@/features/activity/components/activity-timeline";
import { DeleteAccountSection } from "@/features/auth/components/delete-account-section";
import type { UserTeamSummary } from "@/features/teams/server";
import type { ProjectSummary } from "@/features/projects/server";
import type { TaskSummary } from "@/features/tasks/server";
import type { ActivityLogItemDTO } from "@/features/activity/types";
import { MOCK_MEMBERS } from "./mocks";

const REFERENCE_DATE = new Date("2026-11-26T12:00:00.000Z");

const USER_TEAMS: UserTeamSummary[] = [
  {
    id: "team-1",
    name: "Core Engineering",
    description: "Platform & reliability",
    role: "OWNER",
    joinedAt: new Date("2026-10-01T10:00:00Z"),
  },
  {
    id: "team-2",
    name: "Design Systems",
    description: "Polaris UI tokens",
    role: "MANAGER",
    joinedAt: new Date("2026-10-15T10:00:00Z"),
  },
];

const MOCK_PROJECTS: ProjectSummary[] = [
  {
    id: "proj-1",
    teamId: "team-1",
    name: "Core Platform Hardening",
    description: "Security, accessibility, and multi-tenant isolation.",
    status: "ACTIVE",
    startDate: new Date("2026-11-01T00:00:00Z"),
    endDate: new Date("2026-12-15T00:00:00Z"),
    createdAt: new Date("2026-11-01T09:00:00Z"),
    updatedAt: new Date("2026-11-25T14:00:00Z"),
    taskCount: 4,
    createdBy: { id: "user-1", name: "Alice Owner", image: null },
    updatedBy: { id: "user-1", name: "Alice Owner", image: null },
  },
  {
    id: "proj-2",
    teamId: "team-1",
    name: "Polaris Design Tokens",
    description: "WCAG AA token calibration.",
    status: "PLANNING",
    startDate: new Date("2026-11-10T00:00:00Z"),
    endDate: new Date("2026-12-30T00:00:00Z"),
    createdAt: new Date("2026-11-10T09:00:00Z"),
    updatedAt: new Date("2026-11-20T14:00:00Z"),
    taskCount: 2,
    createdBy: { id: "user-2", name: "Bob Manager", image: null },
    updatedBy: null,
  },
];

const MOCK_TASKS: TaskSummary[] = [
  {
    id: "task-1",
    teamId: "team-1",
    projectId: "proj-1",
    title: "Audit dialog focus trap and Escape restoration",
    description: "Ensure modal dialogs restore focus back to the trigger.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate: new Date("2026-11-28T00:00:00Z"),
    assignedToId: "user-1",
    createdById: "user-1",
    updatedById: "user-1",
    createdAt: new Date("2026-11-20T10:00:00Z"),
    updatedAt: new Date("2026-11-25T10:00:00Z"),
    project: { id: "proj-1", name: "Core Platform Hardening", status: "ACTIVE" },
    assignee: { id: "user-1", name: "Alice Owner", image: null },
    createdBy: { id: "user-1", name: "Alice Owner" },
    updatedBy: { id: "user-1", name: "Alice Owner" },
  },
  {
    id: "task-2",
    teamId: "team-1",
    projectId: "proj-1",
    title: "Verify WCAG 2.1 AA badge contrast",
    description: "Check light and dark modes across all variants.",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: new Date("2026-12-01T00:00:00Z"),
    assignedToId: "user-2",
    createdById: "user-1",
    updatedById: null,
    createdAt: new Date("2026-11-22T10:00:00Z"),
    updatedAt: new Date("2026-11-22T10:00:00Z"),
    project: { id: "proj-1", name: "Core Platform Hardening", status: "ACTIVE" },
    assignee: { id: "user-2", name: "Bob Manager", image: null },
    createdBy: { id: "user-1", name: "Alice Owner" },
    updatedBy: null,
  },
  {
    id: "task-3",
    teamId: "team-1",
    projectId: "proj-2",
    title: "Add keyboard navigation to Kanban tabs",
    description: "Support ArrowLeft, ArrowRight, Home, and End.",
    status: "IN_REVIEW",
    priority: "HIGH",
    dueDate: new Date("2026-11-27T00:00:00Z"),
    assignedToId: "user-3",
    createdById: "user-2",
    updatedById: "user-2",
    createdAt: new Date("2026-11-23T10:00:00Z"),
    updatedAt: new Date("2026-11-26T09:00:00Z"),
    project: { id: "proj-2", name: "Polaris Design Tokens", status: "PLANNING" },
    assignee: { id: "user-3", name: "Charlie Member", image: null },
    createdBy: { id: "user-2", name: "Bob Manager" },
    updatedBy: { id: "user-2", name: "Bob Manager" },
  },
  {
    id: "task-4",
    teamId: "team-1",
    projectId: "proj-2",
    title: "Implement skip-to-content landmark",
    description: null,
    status: "DONE",
    priority: "LOW",
    dueDate: null,
    assignedToId: null,
    createdById: "user-1",
    updatedById: "user-1",
    createdAt: new Date("2026-11-18T10:00:00Z"),
    updatedAt: new Date("2026-11-24T16:00:00Z"),
    project: { id: "proj-2", name: "Polaris Design Tokens", status: "PLANNING" },
    assignee: null,
    createdBy: { id: "user-1", name: "Alice Owner" },
    updatedBy: { id: "user-1", name: "Alice Owner" },
  },
];

const MOCK_ACTIVITY: ActivityLogItemDTO[] = [
  {
    id: "act-1",
    teamId: "team-1",
    action: "task_status_changed",
    createdAt: "2026-11-26T11:30:00.000Z",
    actor: { id: "user-2", name: "Bob Manager", image: null, isDeleted: false },
    project: { id: "proj-2", label: "Polaris Design Tokens", isDeleted: false },
    task: { id: "task-3", label: "Add keyboard navigation to Kanban tabs", isDeleted: false },
    commentId: null,
    details: { previousTaskStatus: "IN_PROGRESS", newTaskStatus: "IN_REVIEW" },
  },
  {
    id: "act-2",
    teamId: "team-1",
    action: "project_created",
    createdAt: "2026-11-25T10:00:00.000Z",
    actor: { id: "user-1", name: "Alice Owner", image: null, isDeleted: false },
    project: { id: "proj-1", label: "Core Platform Hardening", isDeleted: false },
    task: null,
    commentId: null,
    details: { projectName: "Core Platform Hardening", projectStatus: "ACTIVE" },
  },
];

function HarnessRoot() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") ?? "dashboard";
  const initialTaskView = params.get("taskView") === "list" ? "list" : "board";

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-teal-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {view === "onboarding" ? (
        <TeamsOnboarding userId="user-1" userName="Alice Owner" />
      ) : view === "account" ? (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <Logo size="sm" href="/teams" />
              <Link
                href="/teams"
                className="inline-flex min-h-[44px] md:min-h-0 items-center gap-1.5 rounded-md px-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Back to Workspaces</span>
              </Link>
            </div>
          </header>
          <main
            id="main-content"
            className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8"
          >
            <div className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Account
                </span>
                <span aria-hidden="true" className="text-xs text-slate-500 dark:text-slate-400">
                  /
                </span>
                <Badge variant="teal" size="sm">
                  Active
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Account Settings
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Review your account identity and manage permanent account deletion.
              </p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle as="h2">Profile Summary</CardTitle>
                <CardDescription>
                  Your registered account identity and connected sign-in methods.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-start gap-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3.5">
                  <UserIcon className="h-4 w-4 text-slate-600 dark:text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Name
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      Alice Owner
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3.5">
                  <Mail className="h-4 w-4 text-slate-600 dark:text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Email
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      alice@example.com
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3.5">
                  <ShieldCheck className="h-4 w-4 text-slate-600 dark:text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Sign-in Method
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="slate" size="sm">
                        Email &amp; Password
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <DeleteAccountSection
              userId="user-1"
              eligibility={{
                eligible: true,
                ownedTeams: [],
                activeAssignedTaskCount: 0,
                hasPasswordAccount: true,
                authProviders: ["Email & Password"],
              }}
            />
          </main>
        </div>
      ) : (
        <div className="flex h-screen flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
          <WorkspaceSidebar
            currentTeam={{ id: "team-1", name: "Core Engineering" }}
            currentRole="OWNER"
            userTeams={USER_TEAMS}
            initialUnreadNotificationsCount={1}
            currentUser={{
              id: "user-1",
              name: "Alice Owner",
              email: "alice@example.com",
              image: null,
            }}
          />
          <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl">
              {view === "projects" ? (
                <ProjectsManager
                  teamId="team-1"
                  projects={MOCK_PROJECTS}
                  currentUserRole="OWNER"
                />
              ) : view === "tasks" ? (
                <TasksManager
                  teamId="team-1"
                  tasks={MOCK_TASKS}
                  projects={MOCK_PROJECTS.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
                  members={MOCK_MEMBERS.map((m) => ({
                    id: m.userId,
                    name: m.name,
                    email: m.email,
                    image: m.image,
                    role: m.role,
                  }))}
                  currentUserId="user-1"
                  currentUserRole="OWNER"
                  initialView={initialTaskView}
                  query={{
                    view: initialTaskView,
                    sort: "priority",
                    dir: "desc",
                    page: 1,
                  }}
                  totalCount={MOCK_TASKS.length}
                  totalPages={1}
                  pageSize={25}
                  referenceDateIso={REFERENCE_DATE.toISOString()}
                />
              ) : view === "activity" ? (
                <div className="flex flex-col gap-6">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      Activity
                    </h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Audit log of projects, tasks, comments, and membership updates.
                    </p>
                  </div>
                  <ActivityTimeline
                    teamId="team-1"
                    initialPage={{
                      items: MOCK_ACTIVITY,
                      nextCursor: null,
                      hasMore: false,
                    }}
                    projects={MOCK_PROJECTS.map((p) => ({ id: p.id, name: p.name }))}
                  />
                </div>
              ) : view === "settings" ? (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Workspace
                      </span>
                      <span aria-hidden="true" className="text-xs text-slate-500 dark:text-slate-400">
                        /
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Settings
                      </span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      Team Settings &amp; Members
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Manage workspace members, role assignments, and ownership for Core Engineering.
                    </p>
                  </div>
                  <TeamMembersManager
                    teamId="team-1"
                    initialMembers={MOCK_MEMBERS}
                    currentUserRole="OWNER"
                    currentUserId="user-1"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        Dashboard
                      </h1>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Team metrics, active workload, and recent updates.
                      </p>
                    </div>
                    <DashboardHeaderActions
                      {...{
                        teamId: "team-1",
                        role: "OWNER" as const,
                        taskFormOptions: {
                          projects: MOCK_PROJECTS.map((p) => ({
                            id: p.id,
                            name: p.name,
                            status: p.status,
                          })),
                          members: MOCK_MEMBERS.map((m) => ({
                            id: m.userId,
                            name: m.name,
                            email: m.email,
                            image: m.image,
                            role: m.role,
                          })),
                        },
                      }}
                    />
                  </div>
                  <DashboardMetricsRow
                    teamId="team-1"
                    currentUserId="user-1"
                    metrics={{
                      activeProjectsCount: 1,
                      totalProjectsCount: 2,
                      myTasksCount: 2,
                      inReviewCount: 1,
                      dueThisWeekCount: 2,
                    }}
                  />
                  <DashboardDistribution
                    totalTasksCount={4}
                    statusBreakdown={[
                      { status: "TODO", label: "To Do", count: 1, percentage: 25 },
                      { status: "IN_PROGRESS", label: "In Progress", count: 1, percentage: 25 },
                      { status: "IN_REVIEW", label: "In Review", count: 1, percentage: 25 },
                      { status: "DONE", label: "Done", count: 1, percentage: 25 },
                    ]}
                    totalOpenTasksCount={3}
                    priorityBreakdown={[
                      { priority: "HIGH", label: "High", count: 2, percentage: 67 },
                      { priority: "MEDIUM", label: "Medium", count: 1, percentage: 33 },
                      { priority: "LOW", label: "Low", count: 0, percentage: 0 },
                    ]}
                  />
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <PrioritizedTaskStream
                      teamId="team-1"
                      tasks={MOCK_TASKS.slice(0, 3).map((t) => ({
                        id: t.id,
                        teamId: t.teamId,
                        projectId: t.projectId,
                        title: t.title,
                        status: t.status,
                        priority: t.priority,
                        dueDate: t.dueDate,
                        createdAt: t.createdAt,
                        project: { id: t.project.id, name: t.project.name },
                        assignee: t.assignee,
                      }))}
                      referenceDate={REFERENCE_DATE}
                    />
                    <RecentActivityPanel teamId="team-1" items={MOCK_ACTIVITY} />
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}
    </>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<HarnessRoot />);
}
