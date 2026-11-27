import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetActionUser,
  mockUserFindFirst,
  mockTeamFindFirst,
  mockTeamMemberFindUnique,
  mockProjectFindFirst,
  mockTaskFindFirst,
  mockQueryTeamActivityFeed,
} = vi.hoisted(() => ({
  mockGetActionUser: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockTeamFindFirst: vi.fn(),
  mockTeamMemberFindUnique: vi.fn(),
  mockProjectFindFirst: vi.fn(),
  mockTaskFindFirst: vi.fn(),
  mockQueryTeamActivityFeed: vi.fn(),
}));

vi.mock("@/features/auth/server", () => ({
  getActionUser: mockGetActionUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: mockUserFindFirst },
    team: { findFirst: mockTeamFindFirst },
    teamMember: { findUnique: mockTeamMemberFindUnique },
    project: { findFirst: mockProjectFindFirst },
    task: { findFirst: mockTaskFindFirst },
  },
}));

vi.mock("../server", () => ({
  queryTeamActivityFeed: mockQueryTeamActivityFeed,
}));

import { getTeamActivityAction } from "../actions";
import { encodeActivityCursor } from "../validation";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("getTeamActivityAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActionUser.mockResolvedValue({ id: USER_ID, deletedAt: null });
    mockUserFindFirst.mockResolvedValue({ id: USER_ID });
    mockTeamFindFirst.mockResolvedValue({ id: TEAM_ID });
    mockTeamMemberFindUnique.mockResolvedValue({ role: "MEMBER" });
    mockProjectFindFirst.mockResolvedValue({ id: PROJECT_ID });
    mockTaskFindFirst.mockResolvedValue({ id: TASK_ID });
    mockQueryTeamActivityFeed.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("rejects unauthenticated callers and malformed teamId", async () => {
    mockGetActionUser.mockResolvedValueOnce(null);
    expect(await getTeamActivityAction(TEAM_ID)).toEqual({
      success: false,
      error: "Authentication required.",
    });

    expect(await getTeamActivityAction("bad-team")).toEqual({
      success: false,
      error: "Invalid team ID.",
    });
    expect(mockQueryTeamActivityFeed).not.toHaveBeenCalled();
  });

  it("rejects invalid pagination cursor and out-of-range limit with fieldErrors", async () => {
    const badCursor = await getTeamActivityAction(TEAM_ID, {
      cursor: "corrupt-cursor",
    });
    expect(badCursor.success).toBe(false);
    if (!badCursor.success) {
      expect(badCursor.fieldErrors?.cursor).toBeDefined();
    }

    const badLimit = await getTeamActivityAction(TEAM_ID, {
      limit: 100,
    });
    expect(badLimit.success).toBe(false);
    if (!badLimit.success) {
      expect(badLimit.fieldErrors?.limit).toBeDefined();
    }
    expect(mockQueryTeamActivityFeed).not.toHaveBeenCalled();
  });

  it("independently verifies active user, active team, and membership without leaking team existence", async () => {
    mockUserFindFirst.mockResolvedValueOnce(null);
    expect(await getTeamActivityAction(TEAM_ID)).toEqual({
      success: false,
      error: "This account is no longer active.",
    });

    mockTeamFindFirst.mockResolvedValueOnce(null);
    expect(await getTeamActivityAction(TEAM_ID)).toEqual({
      success: false,
      error: "Team not found.",
    });

    mockTeamMemberFindUnique.mockResolvedValueOnce(null);
    expect(await getTeamActivityAction(TEAM_ID)).toEqual({
      success: false,
      error: "Team not found.",
    });
    expect(mockQueryTeamActivityFeed).not.toHaveBeenCalled();
  });

  it("returns Project/Task not found for soft-deleted or cross-team scoped filters", async () => {
    mockProjectFindFirst.mockResolvedValueOnce(null);
    expect(
      await getTeamActivityAction(TEAM_ID, { projectId: PROJECT_ID }),
    ).toEqual({
      success: false,
      error: "Project not found.",
    });

    mockTaskFindFirst.mockResolvedValueOnce(null);
    expect(await getTeamActivityAction(TEAM_ID, { taskId: TASK_ID })).toEqual({
      success: false,
      error: "Task not found.",
    });
    expect(mockQueryTeamActivityFeed).not.toHaveBeenCalled();
  });

  it("returns paginated feed on valid authorized request and sanitizes unexpected DB errors", async () => {
    const cursor = encodeActivityCursor({
      createdAt: "2026-11-25T10:00:00.000Z",
      id: TASK_ID,
    });

    const okRes = await getTeamActivityAction(TEAM_ID, {
      limit: 15,
      cursor,
      projectId: PROJECT_ID,
    });

    expect(okRes).toEqual({
      success: true,
      data: {
        items: [],
        nextCursor: null,
        hasMore: false,
      },
    });
    expect(mockQueryTeamActivityFeed).toHaveBeenCalledWith(TEAM_ID, {
      limit: 15,
      cursor: {
        createdAt: new Date("2026-11-25T10:00:00.000Z"),
        id: TASK_ID,
      },
      projectId: PROJECT_ID,
    });

    mockQueryTeamActivityFeed.mockRejectedValueOnce(
      new Error('PrismaClientKnownRequestError: table "activity_log" failed'),
    );
    const errRes = await getTeamActivityAction(TEAM_ID);
    expect(errRes).toEqual({
      success: false,
      error: "Unable to load team activity. Please try again.",
    });
  });
});
