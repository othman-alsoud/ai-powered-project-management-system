import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireTeamMember,
  mockQueryTeamActivityFeed,
  mockProjectFindMany,
  mockProjectGroupBy,
  mockTaskGroupBy,
  mockTaskCount,
  mockTaskFindMany,
  mockTeamMemberFindMany,
} = vi.hoisted(() => ({
  mockRequireTeamMember: vi.fn(),
  mockQueryTeamActivityFeed: vi.fn(),
  mockProjectFindMany: vi.fn(),
  mockProjectGroupBy: vi.fn(),
  mockTaskGroupBy: vi.fn(),
  mockTaskCount: vi.fn(),
  mockTaskFindMany: vi.fn(),
  mockTeamMemberFindMany: vi.fn(),
}));

vi.mock("@/features/teams/server", () => ({
  requireTeamMember: mockRequireTeamMember,
}));

vi.mock("@/features/activity/server", () => ({
  queryTeamActivityFeed: mockQueryTeamActivityFeed,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findMany: mockProjectFindMany,
      groupBy: mockProjectGroupBy,
    },
    task: {
      groupBy: mockTaskGroupBy,
      count: mockTaskCount,
      findMany: mockTaskFindMany,
    },
    teamMember: {
      findMany: mockTeamMemberFindMany,
    },
  },
}));

import { getTeamDashboardData } from "../server";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_TEAM_ID = "99999999-9999-4999-8999-999999999999";

function makeTeamContext(role: "OWNER" | "MANAGER" | "MEMBER" = "OWNER") {
  return {
    user: {
      id: USER_ID,
      name: "Alice",
      email: "alice@example.com",
      emailVerified: true,
      image: null,
      lastActiveTeamId: OTHER_TEAM_ID,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    team: {
      id: TEAM_ID,
      name: "Core Engineering",
      description: "Main team",
      ownerId: USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    membership: {
      teamId: TEAM_ID,
      userId: USER_ID,
      role,
      joinedAt: new Date(),
    },
    role,
  };
}

describe("getTeamDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryTeamActivityFeed.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
    mockProjectFindMany.mockResolvedValue([]);
    mockProjectGroupBy.mockResolvedValue([]);
    mockTaskGroupBy.mockResolvedValue([]);
    mockTaskCount.mockResolvedValue(0);
    mockTaskFindMany.mockResolvedValue([]);
    mockTeamMemberFindMany.mockResolvedValue([]);
  });

  it("enforces requireTeamMember before running any queries and stops when unauthorized", async () => {
    mockRequireTeamMember.mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));

    await expect(getTeamDashboardData(TEAM_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockRequireTeamMember).toHaveBeenCalledWith(TEAM_ID);
    expect(mockProjectFindMany).not.toHaveBeenCalled();
    expect(mockProjectGroupBy).not.toHaveBeenCalled();
    expect(mockTaskGroupBy).not.toHaveBeenCalled();
    expect(mockTaskCount).not.toHaveBeenCalled();
    expect(mockTaskFindMany).not.toHaveBeenCalled();
    expect(mockQueryTeamActivityFeed).not.toHaveBeenCalled();
  });

  it("loads OWNER dashboard metrics, open priority breakdown, UTC due-this-week bounds, top-10 tasks, activity, and task form options without trusting lastActiveTeamId", async () => {
    mockRequireTeamMember.mockResolvedValueOnce(makeTeamContext("OWNER"));

    mockProjectFindMany.mockResolvedValueOnce([
      { id: "p-1", name: "Alpha", status: "ACTIVE" },
      { id: "p-2", name: "Beta", status: "PLANNING" },
      { id: "p-3", name: "Gamma", status: "COMPLETED" },
      { id: "p-4", name: "Delta", status: "ACTIVE" },
    ]);

    mockTaskGroupBy
      .mockResolvedValueOnce([
        { status: "TODO", _count: { _all: 3 } },
        { status: "IN_REVIEW", _count: { _all: 2 } },
        { status: "DONE", _count: { _all: 5 } },
      ])
      .mockResolvedValueOnce([
        { priority: "HIGH", _count: { _all: 4 } },
        { priority: "LOW", _count: { _all: 1 } },
      ]);

    mockTaskCount
      .mockResolvedValueOnce(3) // myTasks
      .mockResolvedValueOnce(2); // dueThisWeek

    mockTaskFindMany.mockResolvedValueOnce([
      {
        id: "t-1",
        teamId: TEAM_ID,
        projectId: "p-1",
        title: "Fix lock contention",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: new Date("2026-11-25T00:00:00.000Z"),
        createdAt: new Date("2026-11-20T09:00:00.000Z"),
        project: { id: "p-1", name: "Alpha" },
        assignee: {
          user: {
            id: "u-deleted",
            name: "Should Be Hidden",
            image: "https://example.com/a.png",
            deletedAt: new Date("2026-11-24T00:00:00.000Z"),
          },
        },
      },
    ]);

    mockTeamMemberFindMany.mockResolvedValueOnce([
      {
        role: "OWNER",
        user: { id: USER_ID, name: "Alice", email: "alice@example.com" },
      },
    ]);

    const referenceDate = new Date("2026-11-26T15:00:00.000Z"); // Thursday UTC
    const result = await getTeamDashboardData(TEAM_ID, { referenceDate });

    // Strict teamId scoping (ignores user.lastActiveTeamId = OTHER_TEAM_ID)
    expect(mockProjectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId: TEAM_ID, deletedAt: null, team: { deletedAt: null } },
      }),
    );
    expect(mockProjectGroupBy).not.toHaveBeenCalled();

    // Active Projects counts ONLY status === "ACTIVE"
    expect(result.metrics).toEqual({
      activeProjectsCount: 2,
      totalProjectsCount: 4,
      myTasksCount: 3,
      inReviewCount: 2,
      dueThisWeekCount: 2,
    });

    // Status distribution includes all 4 statuses; priority breakdown is open tasks only
    expect(result.totalTasksCount).toBe(10);
    expect(result.totalOpenTasksCount).toBe(5);
    expect(mockTaskGroupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        by: ["status"],
        where: { teamId: TEAM_ID, deletedAt: null, project: { deletedAt: null } },
      }),
    );
    expect(mockTaskGroupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        by: ["priority"],
        where: {
          teamId: TEAM_ID,
          deletedAt: null,
          project: { deletedAt: null },
          status: { not: "DONE" },
        },
      }),
    );

    // Due This Week: [2026-11-26T00:00:00.000Z .. 2026-11-29T23:59:59.999Z], status !== DONE
    expect(mockTaskCount).toHaveBeenNthCalledWith(1, {
      where: {
        teamId: TEAM_ID,
        deletedAt: null,
        project: { deletedAt: null },
        assignedToId: USER_ID,
        status: { not: "DONE" },
      },
    });
    expect(mockTaskCount).toHaveBeenNthCalledWith(2, {
      where: {
        teamId: TEAM_ID,
        deletedAt: null,
        project: { deletedAt: null },
        status: { not: "DONE" },
        dueDate: {
          gte: new Date("2026-11-26T00:00:00.000Z"),
          lte: new Date("2026-11-29T23:59:59.999Z"),
        },
      },
    });

    // Prioritized Task Stream query capped at 10 open tasks, masks deleted assignee
    expect(mockTaskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId: TEAM_ID,
          deletedAt: null,
          project: { deletedAt: null },
          status: { not: "DONE" },
        },
        take: 10,
      }),
    );
    expect(result.prioritizedTasks[0]?.assignee).toBeNull();

    // Reuses queryTeamActivityFeed
    expect(mockQueryTeamActivityFeed).toHaveBeenCalledWith(TEAM_ID, { limit: 10 });

    // Task form options populated for OWNER/MANAGER
    expect(result.taskFormOptions).toEqual({
      projects: [
        { id: "p-1", name: "Alpha", status: "ACTIVE" },
        { id: "p-2", name: "Beta", status: "PLANNING" },
        { id: "p-3", name: "Gamma", status: "COMPLETED" },
        { id: "p-4", name: "Delta", status: "ACTIVE" },
      ],
      members: [
        {
          id: USER_ID,
          name: "Alice",
          email: "alice@example.com",
          role: "OWNER",
        },
      ],
    });
  });

  it("uses project.groupBy and skips taskFormOptions queries for MEMBER role", async () => {
    mockRequireTeamMember.mockResolvedValueOnce(makeTeamContext("MEMBER"));
    mockProjectGroupBy.mockResolvedValueOnce([
      { status: "ACTIVE", _count: { _all: 1 } },
      { status: "ON_HOLD", _count: { _all: 2 } },
    ]);

    const result = await getTeamDashboardData(TEAM_ID);

    expect(mockProjectGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["status"],
        where: { teamId: TEAM_ID, deletedAt: null, team: { deletedAt: null } },
      }),
    );
    expect(mockProjectFindMany).not.toHaveBeenCalled();
    expect(mockTeamMemberFindMany).not.toHaveBeenCalled();
    expect(result.metrics.activeProjectsCount).toBe(1);
    expect(result.metrics.totalProjectsCount).toBe(3);
    expect(result.taskFormOptions).toBeNull();
  });
});
