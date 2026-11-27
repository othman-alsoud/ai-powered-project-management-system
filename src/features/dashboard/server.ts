import { queryTeamActivityFeed } from "@/features/activity/server";
import type { ActivityLogItemDTO } from "@/features/activity/types";
import type {
  TeamTaskAssigneeOption,
  TeamTaskProjectOption,
} from "@/features/tasks/server";
import {
  getUtcDueDateBoundaries,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/features/tasks/validation";
import { requireTeamMember } from "@/features/teams/server";
import type { ProjectStatus, TeamRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DASHBOARD_ACTIVITY_LIMIT,
  DASHBOARD_TASK_STREAM_LIMIT,
  buildPriorityBreakdown,
  buildStatusBreakdown,
  sortDashboardPrioritizedTasks,
  type DashboardPriorityItem,
  type DashboardStatusItem,
  type DashboardTaskItem,
} from "./utils";

export interface TeamDashboardMetrics {
  activeProjectsCount: number;
  totalProjectsCount: number;
  myTasksCount: number;
  inReviewCount: number;
  dueThisWeekCount: number;
}

export interface TeamDashboardTaskFormOptions {
  projects: TeamTaskProjectOption[];
  members: TeamTaskAssigneeOption[];
}

export interface TeamDashboardData {
  team: {
    id: string;
    name: string;
    description: string | null;
  };
  currentUser: {
    id: string;
    name: string | null;
  };
  role: TeamRole;
  metrics: TeamDashboardMetrics;
  statusBreakdown: DashboardStatusItem[];
  totalTasksCount: number;
  priorityBreakdown: DashboardPriorityItem[];
  totalOpenTasksCount: number;
  prioritizedTasks: DashboardTaskItem[];
  recentActivity: ActivityLogItemDTO[];
  taskFormOptions: TeamDashboardTaskFormOptions | null;
  referenceDate: Date;
}

type RawDashboardTaskRow = {
  id: string;
  teamId: string;
  projectId: string;
  title: string;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  dueDate: Date | null;
  createdAt: Date;
  project: {
    id: string;
    name: string;
  };
  assignee: {
    user: {
      id: string;
      name: string | null;
      image: string | null;
      deletedAt: Date | null;
    };
  } | null;
};

function mapDashboardTaskRow(row: RawDashboardTaskRow): DashboardTaskItem {
  const assigneeUser = row.assignee?.user ?? null;
  const activeAssignee =
    assigneeUser && assigneeUser.deletedAt === null
      ? {
          id: assigneeUser.id,
          name: assigneeUser.name,
          image: assigneeUser.image,
        }
      : null;

  return {
    id: row.id,
    teamId: row.teamId,
    projectId: row.projectId,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    project: row.project,
    assignee: activeAssignee,
  };
}

/**
 * Loads all team-scoped dashboard metrics, status/priority breakdowns,
 * top 10 prioritized open tasks, and recent team activity for an authorized member.
 */
export async function getTeamDashboardData(
  teamId: string,
  options?: { referenceDate?: Date },
): Promise<TeamDashboardData> {
  const { user, team, role } = await requireTeamMember(teamId);
  const referenceDate = options?.referenceDate ?? new Date();
  const weekBounds = getUtcDueDateBoundaries("this_week", referenceDate);
  const canManageTasks = role === "OWNER" || role === "MANAGER";

  const activeTaskScope = {
    teamId,
    deletedAt: null,
    project: { deletedAt: null },
  };

  const [
    projectData,
    statusGroups,
    priorityGroups,
    myTasksCount,
    dueThisWeekCount,
    rawPrioritizedTasks,
    activityPage,
    memberRows,
  ] = await Promise.all([
    canManageTasks
      ? prisma.project.findMany({
          where: {
            teamId,
            deletedAt: null,
            team: { deletedAt: null },
          },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          select: {
            id: true,
            name: true,
            status: true,
          },
        })
      : prisma.project.groupBy({
          by: ["status"],
          where: {
            teamId,
            deletedAt: null,
            team: { deletedAt: null },
          },
          _count: { _all: true },
        }),
    prisma.task.groupBy({
      by: ["status"],
      where: activeTaskScope,
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["priority"],
      where: {
        ...activeTaskScope,
        status: { not: "DONE" },
      },
      _count: { _all: true },
    }),
    prisma.task.count({
      where: {
        ...activeTaskScope,
        assignedToId: user.id,
        status: { not: "DONE" },
      },
    }),
    prisma.task.count({
      where: {
        ...activeTaskScope,
        status: { not: "DONE" },
        dueDate: {
          gte: weekBounds.gte,
          lte: weekBounds.lte,
        },
      },
    }),
    prisma.task.findMany({
      where: {
        ...activeTaskScope,
        status: { not: "DONE" },
      },
      orderBy: [
        { dueDate: { sort: "asc", nulls: "last" } },
        { priority: "desc" },
        { createdAt: "desc" },
        { id: "asc" },
      ],
      take: DASHBOARD_TASK_STREAM_LIMIT,
      select: {
        id: true,
        teamId: true,
        projectId: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    }) as Promise<RawDashboardTaskRow[]>,
    queryTeamActivityFeed(teamId, { limit: DASHBOARD_ACTIVITY_LIMIT }),
    canManageTasks
      ? prisma.teamMember.findMany({
          where: {
            teamId,
            user: { deletedAt: null },
          },
          orderBy: [{ joinedAt: "asc" }, { userId: "asc" }],
          select: {
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  let activeProjectsCount = 0;
  let totalProjectsCount = 0;
  let projectOptions: TeamTaskProjectOption[] = [];

  if (canManageTasks) {
    const projectRows = projectData as Array<{
      id: string;
      name: string;
      status: ProjectStatus;
    }>;
    totalProjectsCount = projectRows.length;
    activeProjectsCount = projectRows.filter(
      (project) => project.status === "ACTIVE",
    ).length;
    projectOptions = projectRows;
  } else {
    const projectGroups = projectData as Array<{
      status: ProjectStatus;
      _count: { _all: number };
    }>;
    for (const group of projectGroups) {
      totalProjectsCount += group._count._all;
      if (group.status === "ACTIVE") {
        activeProjectsCount += group._count._all;
      }
    }
  }

  const statusResult = buildStatusBreakdown(
    statusGroups.map((group) => ({
      status: group.status as TaskStatusValue,
      count: group._count._all,
    })),
  );

  const priorityResult = buildPriorityBreakdown(
    priorityGroups.map((group) => ({
      priority: group.priority as TaskPriorityValue,
      count: group._count._all,
    })),
  );

  const prioritizedTasks = sortDashboardPrioritizedTasks(
    rawPrioritizedTasks.map(mapDashboardTaskRow),
    referenceDate,
  ).slice(0, DASHBOARD_TASK_STREAM_LIMIT);

  const taskFormOptions: TeamDashboardTaskFormOptions | null =
    canManageTasks && memberRows
      ? {
          projects: projectOptions,
          members: memberRows.map((membership) => ({
            id: membership.user.id,
            name: membership.user.name,
            email: membership.user.email,
            role: membership.role,
          })),
        }
      : null;

  return {
    team: {
      id: team.id,
      name: team.name,
      description: team.description,
    },
    currentUser: {
      id: user.id,
      name: user.name,
    },
    role,
    metrics: {
      activeProjectsCount,
      totalProjectsCount,
      myTasksCount,
      inReviewCount: statusResult.inReviewCount,
      dueThisWeekCount,
    },
    statusBreakdown: statusResult.items,
    totalTasksCount: statusResult.totalTasks,
    priorityBreakdown: priorityResult.items,
    totalOpenTasksCount: priorityResult.totalOpenTasks,
    prioritizedTasks,
    recentActivity: activityPage.items,
    taskFormOptions,
    referenceDate,
  };
}
