import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuthPage,
  mockNotFound,
  mockRequireTeamMember,
  mockActivityLogFindMany,
  mockUserFindMany,
  mockProjectFindFirst,
  mockTaskFindFirst,
} = vi.hoisted(() => ({
  mockRequireAuthPage: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  mockRequireTeamMember: vi.fn(),
  mockActivityLogFindMany: vi.fn(),
  mockUserFindMany: vi.fn(),
  mockProjectFindFirst: vi.fn(),
  mockTaskFindFirst: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

vi.mock("@/features/auth/server", () => ({
  requireAuthPage: mockRequireAuthPage,
}));

vi.mock("@/features/teams/server", () => ({
  requireTeamMember: mockRequireTeamMember,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityLog: {
      findMany: mockActivityLogFindMany,
    },
    user: {
      findMany: mockUserFindMany,
    },
    project: {
      findFirst: mockProjectFindFirst,
    },
    task: {
      findFirst: mockTaskFindFirst,
    },
  },
}));

import { DELETED_USER_DISPLAY_NAME } from "../constants";
import {
  buildActivityWhereInput,
  getProjectActivity,
  getTaskActivity,
  getTeamActivity,
  queryTeamActivityFeed,
} from "../server";
import { decodeActivityCursor, encodeActivityCursor } from "../validation";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const COMMENT_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TARGET_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LOG_1_ID = "99999999-9999-4999-8999-999999999991";
const LOG_2_ID = "99999999-9999-4999-8999-999999999992";
const LOG_3_ID = "99999999-9999-4999-8999-999999999993";

describe("activity server queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeamMember.mockResolvedValue({
      user: { id: ACTOR_ID, name: "Alice", deletedAt: null },
      team: { id: TEAM_ID, name: "Core", deletedAt: null },
      role: "MEMBER",
    });
    mockActivityLogFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([]);
    mockProjectFindFirst.mockResolvedValue({ id: PROJECT_ID });
    mockTaskFindFirst.mockResolvedValue({ id: TASK_ID });
  });

  it("enforces team isolation and Decision 1 soft-delete visibility filters in buildActivityWhereInput", () => {
    const where = buildActivityWhereInput(TEAM_ID);

    expect(where).toEqual({
      teamId: TEAM_ID,
      team: { deletedAt: null },
      AND: [
        {
          OR: [{ projectId: null }, { project: { deletedAt: null } }],
        },
        {
          OR: [
            { taskId: null },
            { task: { deletedAt: null } },
            { action: "task_deleted" },
          ],
        },
        {
          OR: [
            { commentId: null },
            { comment: { deletedAt: null }, task: { deletedAt: null } },
            { action: "comment_deleted", task: { deletedAt: null } },
          ],
        },
      ],
    });
  });

  it("verifies team membership via requireTeamMember and orders deterministically by createdAt desc, id desc", async () => {
    await getTeamActivity(TEAM_ID, { limit: 10 });

    expect(mockRequireTeamMember).toHaveBeenCalledWith(TEAM_ID);
    expect(mockActivityLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildActivityWhereInput(TEAM_ID),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 11,
      }),
    );

    const callArg = mockActivityLogFindMany.mock.calls[0]?.[0] as {
      select: Record<string, unknown>;
    };
    expect(callArg.select.comment).toBeUndefined();
    expect(
      (callArg.select.actor as { select: Record<string, unknown> }).select.email,
    ).toBeUndefined();
  });

  it("rejects unauthorized callers when requireTeamMember throws", async () => {
    mockRequireTeamMember.mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));

    await expect(getTeamActivity(TEAM_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockActivityLogFindMany).not.toHaveBeenCalled();
  });

  it("masks anonymized/null actors and deleted target users as Deleted User and strips legacy addedUserEmail", async () => {
    const t1 = new Date("2026-11-25T12:00:00.000Z");
    const t2 = new Date("2026-11-25T11:00:00.000Z");

    mockActivityLogFindMany.mockResolvedValueOnce([
      {
        id: LOG_1_ID,
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: null,
        taskId: null,
        commentId: null,
        action: "member_added",
        metadata: {
          addedUserId: TARGET_USER_ID,
          addedById: ACTOR_ID,
          addedUserEmail: "secret-legacy@example.com",
          role: "MANAGER",
        },
        createdAt: t1,
        actor: {
          id: ACTOR_ID,
          name: "Deleted User",
          image: "https://example.com/stale.png",
          deletedAt: t1,
        },
        project: null,
        task: null,
      },
      {
        id: LOG_2_ID,
        teamId: TEAM_ID,
        actorId: null,
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        commentId: COMMENT_ID,
        action: "comment_deleted",
        metadata: {
          taskId: TASK_ID,
          taskTitle: "Fix audit query",
          commentId: COMMENT_ID,
          deletedByRole: "OWNER",
          isSelfDelete: false,
          commentContent: "should never leak",
        },
        createdAt: t2,
        actor: null,
        project: { id: PROJECT_ID, name: "Core API", deletedAt: null },
        task: { id: TASK_ID, title: "Fix audit query", deletedAt: null },
      },
    ]);

    mockUserFindMany.mockResolvedValueOnce([
      {
        id: TARGET_USER_ID,
        name: "Old Name",
        deletedAt: new Date("2026-11-24T00:00:00.000Z"),
      },
    ]);

    const page = await queryTeamActivityFeed(TEAM_ID, { limit: 20 });

    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(2);

    const serialized = JSON.stringify(page);
    expect(serialized).not.toContain("secret-legacy@example.com");
    expect(serialized).not.toContain("addedUserEmail");
    expect(serialized).not.toContain("should never leak");
    expect(serialized).not.toContain("stale.png");

    expect(page.items[0]).toEqual({
      id: LOG_1_ID,
      teamId: TEAM_ID,
      action: "member_added",
      createdAt: t1.toISOString(),
      actor: {
        id: null,
        name: DELETED_USER_DISPLAY_NAME,
        image: null,
        isDeleted: true,
      },
      project: null,
      task: null,
      commentId: null,
      details: {
        role: "MANAGER",
        targetUser: {
          id: null,
          name: DELETED_USER_DISPLAY_NAME,
          isDeleted: true,
        },
      },
    });

    expect(page.items[1]).toEqual({
      id: LOG_2_ID,
      teamId: TEAM_ID,
      action: "comment_deleted",
      createdAt: t2.toISOString(),
      actor: {
        id: null,
        name: DELETED_USER_DISPLAY_NAME,
        image: null,
        isDeleted: true,
      },
      project: { id: PROJECT_ID, label: "Core API", isDeleted: false },
      task: { id: TASK_ID, label: "Fix audit query", isDeleted: false },
      commentId: COMMENT_ID,
      details: {
        taskTitle: "Fix audit query",
        deletedByRole: "OWNER",
        isSelfDelete: false,
      },
    });
  });

  it("computes cursor pagination cleanly with take = limit + 1 and applies keyset filter", async () => {
    const t = new Date("2026-11-25T12:00:00.000Z");

    mockActivityLogFindMany.mockResolvedValueOnce([
      {
        id: LOG_3_ID,
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: null,
        taskId: null,
        commentId: null,
        action: "team_created",
        metadata: { teamName: "Core" },
        createdAt: t,
        actor: { id: ACTOR_ID, name: "Alice", image: null, deletedAt: null },
        project: null,
        task: null,
      },
      {
        id: LOG_2_ID,
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: null,
        taskId: null,
        commentId: null,
        action: "team_created",
        metadata: { teamName: "Core" },
        createdAt: t,
        actor: { id: ACTOR_ID, name: "Alice", image: null, deletedAt: null },
        project: null,
        task: null,
      },
      {
        id: LOG_1_ID,
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: null,
        taskId: null,
        commentId: null,
        action: "team_created",
        metadata: { teamName: "Core" },
        createdAt: t,
        actor: { id: ACTOR_ID, name: "Alice", image: null, deletedAt: null },
        project: null,
        task: null,
      },
    ]);

    const cursor = encodeActivityCursor({
      createdAt: "2026-11-25T13:00:00.000Z",
      id: LOG_3_ID,
    });
    const decoded = decodeActivityCursor(cursor)!;

    const page = await queryTeamActivityFeed(TEAM_ID, {
      limit: 2,
      cursor: decoded,
    });

    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeTruthy();
    expect(decodeActivityCursor(page.nextCursor!)).toEqual({
      createdAt: t,
      id: LOG_2_ID,
    });

    const whereArg = mockActivityLogFindMany.mock.calls[0]?.[0]?.where;
    expect(whereArg.AND).toContainEqual({
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    });
  });

  it("returns null for invalid/soft-deleted scoped project or task in getProjectActivity and getTaskActivity", async () => {
    expect(await getProjectActivity(TEAM_ID, "bad-id")).toBeNull();
    expect(await getTaskActivity(TEAM_ID, "bad-id")).toBeNull();

    mockProjectFindFirst.mockResolvedValueOnce(null);
    expect(await getProjectActivity(TEAM_ID, PROJECT_ID)).toBeNull();

    mockTaskFindFirst.mockResolvedValueOnce(null);
    expect(await getTaskActivity(TEAM_ID, TASK_ID)).toBeNull();
    expect(mockActivityLogFindMany).not.toHaveBeenCalled();
  });

  it("resolves active actors/targets, maps project/task/ownership details, and skips unknown actions", async () => {
    const t = new Date("2026-11-25T14:00:00.000Z");

    mockActivityLogFindMany.mockResolvedValueOnce([
      {
        id: LOG_1_ID,
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        commentId: null,
        action: "task_reassigned",
        metadata: {
          title: "Refactor auth",
          previousAssigneeId: ACTOR_ID,
          newAssigneeId: TARGET_USER_ID,
        },
        createdAt: t,
        actor: {
          id: ACTOR_ID,
          name: "Alice",
          image: "https://example.com/alice.png",
          deletedAt: null,
        },
        project: { id: PROJECT_ID, name: "Auth Overhaul", deletedAt: null },
        task: { id: TASK_ID, title: "Refactor auth", deletedAt: null },
      },
      {
        id: LOG_2_ID,
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        commentId: null,
        action: "task_deleted",
        metadata: {
          title: "Old task",
          previousAssigneeId: null,
        },
        createdAt: t,
        actor: {
          id: ACTOR_ID,
          name: "Alice",
          image: null,
          deletedAt: null,
        },
        project: { id: PROJECT_ID, name: "Auth Overhaul", deletedAt: null },
        task: {
          id: TASK_ID,
          title: "Old task",
          deletedAt: new Date("2026-11-25T14:05:00.000Z"),
        },
      },
      {
        id: LOG_3_ID,
        teamId: TEAM_ID,
        actorId: ACTOR_ID,
        projectId: null,
        taskId: null,
        commentId: null,
        action: "future_unrecognized_action",
        metadata: {},
        createdAt: t,
        actor: { id: ACTOR_ID, name: "Alice", image: null, deletedAt: null },
        project: null,
        task: null,
      },
    ]);

    mockUserFindMany.mockResolvedValueOnce([
      { id: ACTOR_ID, name: "Alice", deletedAt: null },
      { id: TARGET_USER_ID, name: "Bob", deletedAt: null },
    ]);

    const page = await getProjectActivity(TEAM_ID, PROJECT_ID, { limit: 10 });

    expect(page).not.toBeNull();
    expect(page!.items).toHaveLength(2);
    expect(page!.items[0]).toEqual({
      id: LOG_1_ID,
      teamId: TEAM_ID,
      action: "task_reassigned",
      createdAt: t.toISOString(),
      actor: {
        id: ACTOR_ID,
        name: "Alice",
        image: "https://example.com/alice.png",
        isDeleted: false,
      },
      project: { id: PROJECT_ID, label: "Auth Overhaul", isDeleted: false },
      task: { id: TASK_ID, label: "Refactor auth", isDeleted: false },
      commentId: null,
      details: {
        taskTitle: "Refactor auth",
        previousAssignee: { id: ACTOR_ID, name: "Alice", isDeleted: false },
        newAssignee: { id: TARGET_USER_ID, name: "Bob", isDeleted: false },
      },
    });
    expect(page!.items[1]?.task).toEqual({
      id: TASK_ID,
      label: "Old task",
      isDeleted: true,
    });
    expect(page!.items[1]?.details).toEqual({
      taskTitle: "Old task",
      previousAssignee: null,
    });
  });

  it("scopes getTaskActivity by taskId when task and project are active", async () => {
    const page = await getTaskActivity(TEAM_ID, TASK_ID, { limit: 5 });

    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
    expect(mockTaskFindFirst).toHaveBeenCalledWith({
      where: {
        id: TASK_ID,
        teamId: TEAM_ID,
        deletedAt: null,
        team: { deletedAt: null },
        project: { deletedAt: null },
      },
      select: { id: true },
    });
    expect(mockActivityLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 6,
      }),
    );
  });

  it("never bypasses authentication or team membership checks on malformed teamId, projectId, or taskId", async () => {
    mockRequireAuthPage.mockRejectedValueOnce(new Error("NEXT_REDIRECT: /sign-in"));
    await expect(getTeamActivity("bad-team")).rejects.toThrow("NEXT_REDIRECT: /sign-in");
    expect(mockRequireAuthPage).toHaveBeenCalledTimes(1);

    mockRequireAuthPage.mockResolvedValueOnce({ id: ACTOR_ID });
    await expect(getTeamActivity("bad-team")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledTimes(1);

    // Malformed projectId/taskId must still invoke requireTeamMember(TEAM_ID) first
    expect(await getProjectActivity(TEAM_ID, "bad-project")).toBeNull();
    expect(await getTaskActivity(TEAM_ID, "bad-task")).toBeNull();
    expect(mockRequireTeamMember).toHaveBeenCalledTimes(2);
    expect(mockRequireTeamMember).toHaveBeenCalledWith(TEAM_ID);
  });

  it("preserves valid parsed search params in getTeamActivity without discarding valid fields", async () => {
    await getTeamActivity(TEAM_ID, {
      limit: 15,
      action: "task_created",
      projectId: PROJECT_ID,
      cursor: "corrupt-cursor",
    });

    expect(mockActivityLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 16,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { projectId: PROJECT_ID },
            { action: "task_created" },
          ]),
        }),
      }),
    );
  });
});
