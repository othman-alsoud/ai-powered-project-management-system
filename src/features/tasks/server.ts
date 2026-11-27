import type {
  Prisma,
  ProjectStatus,
  TeamRole,
} from "@/generated/prisma/client";
import { requireTeamMember } from "@/features/teams/server";
import { prisma } from "@/lib/prisma";
import {
  TASK_LIST_PAGE_SIZE,
  getUtcDueDateBoundaries,
  isValidUuid,
  parseTaskQueryParams,
  type TaskPriorityValue,
  type TaskQueryState,
  type TaskSortDirection,
  type TaskSortField,
  type TaskStatusValue,
} from "./validation";

export interface TaskAssigneeSummary {
  id: string;
  name: string | null;
  image: string | null;
}

export interface TaskProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
}

export interface TaskSummary {
  id: string;
  teamId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  dueDate: Date | null;
  assignedToId: string | null;
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  project: TaskProjectSummary;
  assignee: TaskAssigneeSummary | null;
  createdBy: {
    id: string;
    name: string | null;
  };
  updatedBy: {
    id: string;
    name: string | null;
  } | null;
}

export interface TeamTaskProjectOption {
  id: string;
  name: string;
  status: ProjectStatus;
}

export interface TeamTaskAssigneeOption {
  id: string;
  name: string | null;
  email: string;
  role: TeamRole;
}

const taskSummarySelect = {
  id: true,
  teamId: true,
  projectId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  assignedToId: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      name: true,
      status: true,
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
  createdBy: {
    select: {
      id: true,
      name: true,
    },
  },
  updatedBy: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

type RawTaskRow = {
  id: string;
  teamId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  dueDate: Date | null;
  assignedToId: string | null;
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  project: TaskProjectSummary;
  assignee: {
    user: {
      id: string;
      name: string | null;
      image: string | null;
      deletedAt: Date | null;
    };
  } | null;
  createdBy: {
    id: string;
    name: string | null;
  };
  updatedBy: {
    id: string;
    name: string | null;
  } | null;
};

function mapTaskSummary(row: RawTaskRow): TaskSummary {
  const assigneeUser = row.assignee?.user ?? null;
  const activeAssignee =
    assigneeUser && !assigneeUser.deletedAt
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
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    assignedToId: activeAssignee ? row.assignedToId : null,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    project: row.project,
    assignee: activeAssignee,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
}

export interface TaskPageResult {
  tasks: TaskSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function buildTaskWhereInput(
  teamId: string,
  query: Partial<
    Pick<TaskQueryState, "q" | "status" | "priority" | "assignee" | "due">
  >,
  options?: { projectId?: string; referenceDate?: Date },
): Prisma.TaskWhereInput {
  const andClauses: Prisma.TaskWhereInput[] = [];

  if (query.q && query.q.trim().length > 0) {
    const keyword = query.q.trim();
    andClauses.push({
      OR: [
        { title: { contains: keyword, mode: "insensitive" } },
        { project: { name: { contains: keyword, mode: "insensitive" } } },
      ],
    });
  }

  if (query.status) {
    andClauses.push({ status: query.status });
  }

  if (query.priority) {
    andClauses.push({ priority: query.priority });
  }

  if (query.assignee === "unassigned") {
    andClauses.push({ assignedToId: null });
  } else if (query.assignee && isValidUuid(query.assignee)) {
    andClauses.push({ assignedToId: query.assignee });
  }

  if (query.due) {
    const boundaries = getUtcDueDateBoundaries(
      query.due,
      options?.referenceDate,
    );
    const dateFilter: Prisma.DateTimeNullableFilter = {};
    if (boundaries.gte) dateFilter.gte = boundaries.gte;
    if (boundaries.lt) dateFilter.lt = boundaries.lt;
    if (boundaries.lte) dateFilter.lte = boundaries.lte;

    andClauses.push({
      dueDate: dateFilter,
      ...(boundaries.excludeDone ? { status: { not: "DONE" } } : {}),
    });
  }

  return {
    teamId,
    deletedAt: null,
    project: { deletedAt: null },
    ...(options?.projectId ? { projectId: options.projectId } : {}),
    ...(andClauses.length > 0 ? { AND: andClauses } : {}),
  };
}

export function buildTaskOrderBy(
  sort: TaskSortField,
  dir: TaskSortDirection,
): Prisma.TaskOrderByWithRelationInput[] {
  if (sort === "dueDate") {
    return [
      { dueDate: { sort: dir, nulls: "last" } },
      { createdAt: "desc" },
      { id: "asc" },
    ];
  }
  if (sort === "priority") {
    return [{ priority: dir }, { createdAt: "desc" }, { id: "asc" }];
  }
  if (sort === "title") {
    return [{ title: dir }, { createdAt: "desc" }, { id: "asc" }];
  }
  return [{ createdAt: dir }, { id: "asc" }];
}

/**
 * Loads non-deleted tasks for Board (unpaginated, all matching rows) or List
 * (server-paginated at 25/page with validated sorting) strictly scoped to the team.
 */
export async function getTeamTasksPageResult(
  teamId: string,
  rawQuery?: Partial<TaskQueryState>,
  options?: { projectId?: string; referenceDate?: Date },
): Promise<TaskPageResult> {
  await requireTeamMember(teamId);

  if (options?.projectId !== undefined && !isValidUuid(options.projectId)) {
    return {
      tasks: [],
      totalCount: 0,
      page: 1,
      pageSize: TASK_LIST_PAGE_SIZE,
      totalPages: 1,
    };
  }

  const normalized = parseTaskQueryParams({
    view: rawQuery?.view,
    q: rawQuery?.q,
    status: rawQuery?.status,
    priority: rawQuery?.priority,
    assignee: rawQuery?.assignee,
    due: rawQuery?.due,
    sort: rawQuery?.sort,
    dir: rawQuery?.dir,
    page: rawQuery?.page !== undefined ? String(rawQuery.page) : undefined,
  });

  const where = buildTaskWhereInput(teamId, normalized, options);

  if (normalized.view === "board") {
    const rows = (await prisma.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: taskSummarySelect,
    })) as unknown as RawTaskRow[];

    const tasks = rows.map(mapTaskSummary);
    return {
      tasks,
      totalCount: tasks.length,
      page: 1,
      pageSize: TASK_LIST_PAGE_SIZE,
      totalPages: 1,
    };
  }

  if (normalized.page === 1) {
    const [totalCount, rows] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        orderBy: buildTaskOrderBy(normalized.sort, normalized.dir),
        skip: 0,
        take: TASK_LIST_PAGE_SIZE,
        select: taskSummarySelect,
      }) as unknown as Promise<RawTaskRow[]>,
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / TASK_LIST_PAGE_SIZE));
    return {
      tasks: rows.map(mapTaskSummary),
      totalCount,
      page: 1,
      pageSize: TASK_LIST_PAGE_SIZE,
      totalPages,
    };
  }

  const totalCount = await prisma.task.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / TASK_LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, normalized.page), totalPages);

  const rows = (await prisma.task.findMany({
    where,
    orderBy: buildTaskOrderBy(normalized.sort, normalized.dir),
    skip: (safePage - 1) * TASK_LIST_PAGE_SIZE,
    take: TASK_LIST_PAGE_SIZE,
    select: taskSummarySelect,
  })) as unknown as RawTaskRow[];

  return {
    tasks: rows.map(mapTaskSummary),
    totalCount,
    page: safePage,
    pageSize: TASK_LIST_PAGE_SIZE,
    totalPages,
  };
}

/**
 * Loads non-deleted tasks within a team whose parent project is also non-deleted.
 */
export async function getTeamTasks(
  teamId: string,
  options?: { projectId?: string },
): Promise<TaskSummary[]> {
  await requireTeamMember(teamId);

  if (options?.projectId !== undefined && !isValidUuid(options.projectId)) {
    return [];
  }

  const rows = (await prisma.task.findMany({
    where: {
      teamId,
      deletedAt: null,
      project: { deletedAt: null },
      ...(options?.projectId ? { projectId: options.projectId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: taskSummarySelect,
  })) as unknown as RawTaskRow[];

  return rows.map(mapTaskSummary);
}

/**
 * Loads non-deleted tasks belonging to a single project within the team.
 */
export async function getProjectTasks(
  projectId: string,
  teamId: string,
): Promise<TaskSummary[]> {
  return getTeamTasks(teamId, { projectId });
}

/**
 * Loads a single non-deleted task inside the team, returning null for invalid UUIDs or missing rows.
 */
export async function getTaskById(
  taskId: string,
  teamId: string,
): Promise<TaskSummary | null> {
  await requireTeamMember(teamId);

  if (!isValidUuid(taskId)) {
    return null;
  }

  const row = (await prisma.task.findFirst({
    where: {
      id: taskId,
      teamId,
      deletedAt: null,
      project: { deletedAt: null },
    },
    select: taskSummarySelect,
  })) as unknown as RawTaskRow | null;

  return row ? mapTaskSummary(row) : null;
}

/**
 * Loads non-deleted projects and active team members for task create/edit forms and filters.
 * Set includeProjects = false when caller only needs assignee filter options (e.g. MEMBER role).
 */
export async function getTaskFormOptions(
  teamId: string,
  options?: { includeProjects?: boolean },
): Promise<{
  projects: TeamTaskProjectOption[];
  members: TeamTaskAssigneeOption[];
}> {
  await requireTeamMember(teamId);

  const includeProjects = options?.includeProjects ?? true;

  const [projects, memberships] = await Promise.all([
    includeProjects
      ? prisma.project.findMany({
          where: {
            teamId,
            deletedAt: null,
          },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          select: {
            id: true,
            name: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    prisma.teamMember.findMany({
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
    }),
  ]);

  return {
    projects,
    members: memberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
    })),
  };
}
