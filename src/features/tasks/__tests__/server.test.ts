import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireTeamMember, mockTaskFindMany, mockTaskFindFirst, mockTaskCount, mockProjectFindMany, mockTeamMemberFindMany } =
  vi.hoisted(() => ({
    mockRequireTeamMember: vi.fn(),
    mockTaskFindMany: vi.fn(),
    mockTaskFindFirst: vi.fn(),
    mockTaskCount: vi.fn(),
    mockProjectFindMany: vi.fn(),
    mockTeamMemberFindMany: vi.fn(),
  }));

vi.mock("@/features/teams/server", () => ({
  requireTeamMember: mockRequireTeamMember,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: mockTaskFindMany,
      findFirst: mockTaskFindFirst,
      count: mockTaskCount,
    },
    project: {
      findMany: mockProjectFindMany,
    },
    teamMember: {
      findMany: mockTeamMemberFindMany,
    },
  },
}));

import {
  getProjectTasks,
  getTaskById,
  getTaskFormOptions,
  getTeamTasks,
  getTeamTasksPageResult,
} from "../server";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";

function makeRawTask(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: "Implement tasks",
    description: "Task details",
    status: "TODO",
    priority: "HIGH",
    dueDate: new Date("2026-12-01T00:00:00.000Z"),
    assignedToId: "44444444-4444-4444-8444-444444444444",
    createdById: "55555555-5555-4555-8555-555555555555",
    updatedById: "55555555-5555-4555-8555-555555555555",
    createdAt: new Date("2026-11-24T10:00:00.000Z"),
    updatedAt: new Date("2026-11-24T10:00:00.000Z"),
    project: {
      id: PROJECT_ID,
      name: "Core Platform",
      status: "ACTIVE",
    },
    assignee: {
      user: {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Alex",
        image: null,
        deletedAt: null,
      },
    },
    createdBy: {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Sam",
    },
    updatedBy: {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Sam",
    },
    ...overrides,
  };
}

describe("tasks server queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeamMember.mockResolvedValue({
      team: { id: TEAM_ID, name: "Alpha" },
      role: "MEMBER",
    });
  });

  it("getTeamTasks enforces team membership and filters out soft-deleted tasks and projects", async () => {
    mockTaskFindMany.mockResolvedValue([makeRawTask()]);

    const tasks = await getTeamTasks(TEAM_ID);

    expect(mockRequireTeamMember).toHaveBeenCalledWith(TEAM_ID);
    expect(mockTaskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId: TEAM_ID,
          deletedAt: null,
          project: { deletedAt: null },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.assignee).toEqual({
      id: "44444444-4444-4444-8444-444444444444",
      name: "Alex",
      image: null,
    });
  });

  it("getTeamTasks returns [] without calling Prisma if optional projectId filter is malformed", async () => {
    const tasks = await getTeamTasks(TEAM_ID, { projectId: "not-a-uuid" });

    expect(mockRequireTeamMember).toHaveBeenCalledWith(TEAM_ID);
    expect(mockTaskFindMany).not.toHaveBeenCalled();
    expect(tasks).toEqual([]);
  });

  it("getProjectTasks scopes tasks to teamId + projectId and rejects malformed UUIDs cleanly", async () => {
    mockTaskFindMany.mockResolvedValue([makeRawTask()]);
    const tasks = await getProjectTasks(PROJECT_ID, TEAM_ID);

    expect(mockTaskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId: TEAM_ID,
          projectId: PROJECT_ID,
          deletedAt: null,
          project: { deletedAt: null },
        },
      }),
    );
    expect(tasks).toHaveLength(1);

    vi.clearAllMocks();
    mockRequireTeamMember.mockResolvedValue({
      team: { id: TEAM_ID, name: "Alpha" },
      role: "MEMBER",
    });

    const invalid = await getProjectTasks("bad-uuid", TEAM_ID);
    expect(invalid).toEqual([]);
    expect(mockTaskFindMany).not.toHaveBeenCalled();
  });

  it("getTaskById returns null on malformed taskId without querying Prisma", async () => {
    const result = await getTaskById("not-a-uuid", TEAM_ID);

    expect(mockRequireTeamMember).toHaveBeenCalledWith(TEAM_ID);
    expect(mockTaskFindFirst).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("getTaskById queries by id + teamId + non-deleted task and project", async () => {
    mockTaskFindFirst.mockResolvedValue(makeRawTask());

    const result = await getTaskById(TASK_ID, TEAM_ID);

    expect(mockTaskFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: TASK_ID,
          teamId: TEAM_ID,
          deletedAt: null,
          project: { deletedAt: null },
        },
      }),
    );
    expect(result?.id).toBe(TASK_ID);
  });

  it("getTaskFormOptions loads non-deleted projects and active team members", async () => {
    mockProjectFindMany.mockResolvedValue([
      { id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" },
    ]);
    mockTeamMemberFindMany.mockResolvedValue([
      {
        role: "OWNER",
        user: { id: "u1", name: "Sam", email: "sam@example.com" },
      },
    ]);

    const options = await getTaskFormOptions(TEAM_ID);

    expect(mockRequireTeamMember).toHaveBeenCalledWith(TEAM_ID);
    expect(mockProjectFindMany).toHaveBeenCalledWith({
      where: { teamId: TEAM_ID, deletedAt: null },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, status: true },
    });
    expect(mockTeamMemberFindMany).toHaveBeenCalledWith({
      where: { teamId: TEAM_ID, user: { deletedAt: null } },
      orderBy: [{ joinedAt: "asc" }, { userId: "asc" }],
      select: {
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    expect(options).toEqual({
      projects: [{ id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" }],
      members: [
        { id: "u1", name: "Sam", email: "sam@example.com", role: "OWNER" },
      ],
    });
  });

  it("getTaskFormOptions skips project query when includeProjects is false", async () => {
    mockTeamMemberFindMany.mockResolvedValue([
      {
        role: "MEMBER",
        user: { id: "u2", name: "Mia", email: "mia@example.com" },
      },
    ]);

    const options = await getTaskFormOptions(TEAM_ID, { includeProjects: false });

    expect(mockRequireTeamMember).toHaveBeenCalledWith(TEAM_ID);
    expect(mockProjectFindMany).not.toHaveBeenCalled();
    expect(options).toEqual({
      projects: [],
      members: [
        { id: "u2", name: "Mia", email: "mia@example.com", role: "MEMBER" },
      ],
    });
  });

  describe("getTeamTasksPageResult (search, filtering, sorting & list pagination)", () => {
    it("applies search across title & project name plus all 4 filters while preserving Board unpaginated retrieval", async () => {
      mockTaskFindMany.mockResolvedValue([makeRawTask()]);
      const refDate = new Date("2026-11-24T10:00:00.000Z");

      const result = await getTeamTasksPageResult(
        TEAM_ID,
        {
          view: "board",
          q: "Platform",
          status: "TODO",
          priority: "HIGH",
          assignee: "44444444-4444-4444-8444-444444444444",
          due: "overdue",
          sort: "dueDate",
          dir: "asc",
          page: 4,
        },
        { referenceDate: refDate },
      );

      expect(mockTaskCount).not.toHaveBeenCalled();
      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            teamId: TEAM_ID,
            deletedAt: null,
            project: { deletedAt: null },
            AND: [
              {
                OR: [
                  { title: { contains: "Platform", mode: "insensitive" } },
                  { project: { name: { contains: "Platform", mode: "insensitive" } } },
                ],
              },
              { status: "TODO" },
              { priority: "HIGH" },
              { assignedToId: "44444444-4444-4444-8444-444444444444" },
              {
                dueDate: { lt: new Date("2026-11-24T00:00:00.000Z") },
                status: { not: "DONE" },
              },
            ],
          },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        }),
      );
      expect(result.tasks).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.totalCount).toBe(1);
    });

    it("paginates List view at 25 per page, clamps out-of-range page, and applies dueDate nulls-last sorting", async () => {
      mockTaskCount.mockResolvedValue(40);
      mockTaskFindMany.mockResolvedValue([makeRawTask()]);

      const result = await getTeamTasksPageResult(
        TEAM_ID,
        {
          view: "list",
          q: undefined,
          status: undefined,
          priority: undefined,
          assignee: "unassigned",
          due: undefined,
          sort: "dueDate",
          dir: "asc",
          page: 9,
        },
        { projectId: PROJECT_ID },
      );

      expect(mockTaskCount).toHaveBeenCalledWith({
        where: {
          teamId: TEAM_ID,
          projectId: PROJECT_ID,
          deletedAt: null,
          project: { deletedAt: null },
          AND: [{ assignedToId: null }],
        },
      });
      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
          orderBy: [
            { dueDate: { sort: "asc", nulls: "last" } },
            { createdAt: "desc" },
            { id: "asc" },
          ],
        }),
      );
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(25);
      expect(result.totalPages).toBe(2);
      expect(result.totalCount).toBe(40);
    });

    it("returns empty paginated result without calling Prisma if scoped projectId is malformed", async () => {
      const result = await getTeamTasksPageResult(
        TEAM_ID,
        {
          view: "list",
          sort: "createdAt",
          dir: "desc",
          page: 1,
        },
        { projectId: "bad-project-id" },
      );

      expect(mockTaskCount).not.toHaveBeenCalled();
      expect(mockTaskFindMany).not.toHaveBeenCalled();
      expect(result).toEqual({
        tasks: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      });
    });

    it("fetches page 1 tasks and count concurrently without sequential waterfall", async () => {
      mockTaskCount.mockResolvedValueOnce(1);
      mockTaskFindMany.mockResolvedValueOnce([makeRawTask()]);

      const result = await getTeamTasksPageResult(TEAM_ID, {
        view: "list",
        sort: "createdAt",
        dir: "desc",
        page: 1,
      });

      expect(mockTaskCount).toHaveBeenCalledTimes(1);
      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 25,
        }),
      );
      expect(result.page).toBe(1);
      expect(result.totalCount).toBe(1);
      expect(result.tasks).toHaveLength(1);
    });
  });
});
