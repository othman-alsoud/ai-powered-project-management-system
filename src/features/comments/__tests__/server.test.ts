import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireTeamMember,
  mockCommentFindMany,
  mockCommentCount,
  mockTaskFindFirst,
} = vi.hoisted(() => ({
  mockRequireTeamMember: vi.fn(),
  mockCommentFindMany: vi.fn(),
  mockCommentCount: vi.fn(),
  mockTaskFindFirst: vi.fn(),
}));

vi.mock("@/features/teams/server", () => ({
  requireTeamMember: mockRequireTeamMember,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      findMany: mockCommentFindMany,
      count: mockCommentCount,
    },
    task: {
      findFirst: mockTaskFindFirst,
    },
  },
}));

import { COMMENT_THREAD_LIMIT } from "../validation";
import { getTaskComments, mapCommentRowToSummary } from "../server";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMMENT_1_ID = "55555555-5555-4555-8555-555555555551";
const COMMENT_2_ID = "55555555-5555-4555-8555-555555555552";

describe("Comment server queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeamMember.mockResolvedValue({
      user: { id: USER_ID, name: "Alice", deletedAt: null },
      role: "MEMBER",
    });
    mockTaskFindFirst.mockResolvedValue({ id: TASK_ID });
    mockCommentFindMany.mockResolvedValue([]);
    mockCommentCount.mockResolvedValue(0);
  });

  it("maps anonymized and soft-deleted authors to Deleted User cleanly", () => {
    const t0 = new Date("2026-11-25T10:00:00.000Z");
    const t1 = new Date("2026-11-25T10:05:00.000Z");

    const anonymized = mapCommentRowToSummary({
      id: COMMENT_1_ID,
      teamId: TEAM_ID,
      taskId: TASK_ID,
      userId: null,
      content: "Legacy note",
      createdAt: t0,
      updatedAt: t0,
      user: null,
    });

    expect(anonymized).toEqual({
      id: COMMENT_1_ID,
      teamId: TEAM_ID,
      taskId: TASK_ID,
      userId: null,
      content: "Legacy note",
      createdAt: t0.toISOString(),
      updatedAt: t0.toISOString(),
      isEdited: false,
      author: { id: null, name: "Deleted User" },
    });

    const deletedUserStillLinked = mapCommentRowToSummary({
      id: COMMENT_2_ID,
      teamId: TEAM_ID,
      taskId: TASK_ID,
      userId: USER_ID,
      content: "Edited note",
      createdAt: t0,
      updatedAt: t1,
      user: { id: USER_ID, name: "Deleted User", deletedAt: t1 },
    });

    expect(deletedUserStillLinked.isEdited).toBe(true);
    expect(deletedUserStillLinked.author.name).toBe("Deleted User");
  });

  it("returns null for malformed teamId or taskId without calling Prisma", async () => {
    expect(await getTaskComments("bad-team", TASK_ID)).toBeNull();
    expect(await getTaskComments(TEAM_ID, "bad-task")).toBeNull();
    expect(mockRequireTeamMember).not.toHaveBeenCalled();
    expect(mockTaskFindFirst).not.toHaveBeenCalled();
  });

  it("verifies team membership and returns null when task is missing, soft-deleted, or cross-team", async () => {
    mockTaskFindFirst.mockResolvedValue(null);

    const result = await getTaskComments(TEAM_ID, TASK_ID);
    expect(mockRequireTeamMember).toHaveBeenCalledWith(TEAM_ID);
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
    expect(result).toBeNull();
    expect(mockCommentFindMany).not.toHaveBeenCalled();
  });

  it("queries the newest 200 active comments with desc slice + asc chronological reversal and deterministic id tie-breaker", async () => {
    const baseMs = Date.UTC(2026, 10, 1, 0, 0, 0);
    const allRows = Array.from({ length: 210 }, (_, idx) => {
      // Force equal timestamps on indices 208 and 209 to verify id tie-breaking
      const tsOffsetMinutes = idx === 209 ? 208 : idx;
      const createdAt = new Date(baseMs + tsOffsetMinutes * 60_000);
      return {
        id: `55555555-5555-4555-8555-${String(idx + 1).padStart(12, "0")}`,
        teamId: TEAM_ID,
        taskId: TASK_ID,
        userId: USER_ID,
        content: `Comment #${idx + 1}`,
        createdAt,
        updatedAt: createdAt,
        user: { id: USER_ID, name: "Alice", deletedAt: null },
      };
    });

    mockCommentFindMany.mockImplementation(
      async (args: {
        orderBy?: Array<{ createdAt?: "asc" | "desc"; id?: "asc" | "desc" }>;
        take?: number;
      }) => {
        const createdDir =
          args.orderBy?.find((o) => o.createdAt)?.createdAt ?? "asc";
        const idDir = args.orderBy?.find((o) => o.id)?.id ?? "asc";

        const sorted = [...allRows].sort((a, b) => {
          const timeDiff =
            createdDir === "desc"
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime();
          if (timeDiff !== 0) return timeDiff;
          return idDir === "desc"
            ? b.id.localeCompare(a.id)
            : a.id.localeCompare(b.id);
        });

        return sorted.slice(0, args.take ?? sorted.length);
      },
    );
    mockCommentCount.mockResolvedValue(210);

    const result = await getTaskComments(TEAM_ID, TASK_ID);

    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId: TEAM_ID,
          taskId: TASK_ID,
          deletedAt: null,
          task: {
            deletedAt: null,
            team: { deletedAt: null },
            project: { deletedAt: null },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: COMMENT_THREAD_LIMIT,
      }),
    );

    expect(result).not.toBeNull();
    expect(result!.totalCount).toBe(210);
    expect(result!.isCapped).toBe(true);
    expect(result!.limit).toBe(COMMENT_THREAD_LIMIT);
    expect(result!.comments).toHaveLength(COMMENT_THREAD_LIMIT);

    // Must contain the newest 200 (#11..#210), NOT the oldest 200 (#1..#200), in ascending order
    expect(result!.comments[0]?.content).toBe("Comment #11");
    expect(result!.comments[197]?.content).toBe("Comment #208");
    // Equal timestamps on #209 and #210 must break tie cleanly in ascending ID order
    expect(result!.comments[198]?.content).toBe("Comment #209");
    expect(result!.comments[199]?.content).toBe("Comment #210");
  });
});
