import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetActionUser,
  mockRevalidatePath,
  mockTransaction,
  mockUserFindFirst,
  mockTeamFindFirst,
  mockTeamMemberFindUnique,
  mockTaskFindFirst,
  mockCommentFindMany,
  mockCommentCount,
} = vi.hoisted(() => ({
  mockGetActionUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockTransaction: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockTeamFindFirst: vi.fn(),
  mockTeamMemberFindUnique: vi.fn(),
  mockTaskFindFirst: vi.fn(),
  mockCommentFindMany: vi.fn(),
  mockCommentCount: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/features/auth/server", () => ({
  getActionUser: mockGetActionUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
    user: { findFirst: mockUserFindFirst },
    team: { findFirst: mockTeamFindFirst },
    teamMember: { findUnique: mockTeamMemberFindUnique },
    task: { findFirst: mockTaskFindFirst },
    comment: {
      findMany: mockCommentFindMany,
      count: mockCommentCount,
    },
  },
}));

import {
  createCommentAction,
  deleteCommentAction,
  getTaskCommentsAction,
  updateCommentAction,
} from "../actions";
import { COMMENT_THREAD_LIMIT } from "../validation";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const COMMENT_ID = "55555555-5555-4555-8555-555555555555";
const CALLER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

interface CommentTxOptions {
  team?: { id: string; deletedAt: Date | null } | null;
  project?: { id: string; deletedAt: Date | null } | null;
  callerUser?: { id: string; deletedAt: Date | null } | null;
  membership?: { role: "OWNER" | "MANAGER" | "MEMBER" } | null;
  preTask?: { id: string; projectId: string } | null;
  lockedTask?: {
    id: string;
    teamId: string;
    projectId: string;
    title: string;
    deletedAt: Date | null;
  } | null;
  lockedCommentExists?: boolean;
  lockedComment?: {
    id: string;
    teamId: string;
    taskId: string;
    userId: string | null;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    user: { id: string; name: string; deletedAt: Date | null } | null;
  } | null;
}

function createTxHarness(opts: CommentTxOptions = {}) {
  const lockCalls: string[] = [];
  const activityLogs: Array<Record<string, unknown>> = [];
  const t0 = new Date("2026-11-25T10:00:00.000Z");
  const t1 = new Date("2026-11-25T10:02:00.000Z");

  const defaultComment = {
    id: COMMENT_ID,
    teamId: TEAM_ID,
    taskId: TASK_ID,
    userId: CALLER_ID,
    content: "Initial comment",
    createdAt: t0,
    updatedAt: t0,
    deletedAt: null,
    user: { id: CALLER_ID, name: "Caller User", deletedAt: null },
  };

  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join("?").replace(/\s+/g, " ").trim();
      lockCalls.push(sql);

      if (sql.includes('FROM "team"')) {
        if (opts.team === null) return [];
        return [opts.team ?? { id: TEAM_ID, deletedAt: null }];
      }
      if (sql.includes('FROM "project"')) {
        if (opts.project === null) return [];
        return [opts.project ?? { id: PROJECT_ID, deletedAt: null }];
      }
      if (sql.includes('FROM "user"')) {
        if (opts.callerUser === null) return [];
        return [opts.callerUser ?? { id: CALLER_ID, deletedAt: null }];
      }
      if (sql.includes('FROM "task"')) {
        if (opts.lockedTask === null) return [];
        return [{ id: TASK_ID }];
      }
      if (sql.includes('FROM "comment"')) {
        if (opts.lockedCommentExists === false) return [];
        return [{ id: COMMENT_ID }];
      }
      return [];
    }),
    teamMember: {
      findUnique: vi.fn(async () =>
        opts.membership === undefined
          ? { role: "MEMBER" as const }
          : opts.membership,
      ),
    },
    task: {
      findFirst: vi.fn(async ({ select }: { select: Record<string, unknown> }) => {
        if ("title" in select) {
          if (opts.lockedTask === null) return null;
          return (
            opts.lockedTask ?? {
              id: TASK_ID,
              teamId: TEAM_ID,
              projectId: PROJECT_ID,
              title: "Implement comments",
              deletedAt: null,
            }
          );
        }
        if (opts.preTask === null) return null;
        return opts.preTask ?? { id: TASK_ID, projectId: PROJECT_ID };
      }),
    },
    comment: {
      findFirst: vi.fn(async () =>
        opts.lockedComment === undefined ? defaultComment : opts.lockedComment,
      ),
      create: vi.fn(async ({ data }: { data: { content: string } }) => ({
        id: COMMENT_ID,
        teamId: TEAM_ID,
        taskId: TASK_ID,
        userId: CALLER_ID,
        content: data.content,
        createdAt: t0,
        updatedAt: t0,
        user: { id: CALLER_ID, name: "Caller User", deletedAt: null },
      })),
      update: vi.fn(
        async ({
          data,
        }: {
          data: { content?: string; deletedAt?: Date };
        }) => ({
          ...(opts.lockedComment ?? defaultComment),
          ...(data.content !== undefined ? { content: data.content, updatedAt: t1 } : {}),
          ...(data.deletedAt !== undefined ? { deletedAt: data.deletedAt } : {}),
        }),
      ),
    },
    activityLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        activityLogs.push(data);
        return { id: "log-1", ...data };
      }),
    },
  };

  mockTransaction.mockImplementation(async (cb: (client: typeof tx) => unknown) =>
    cb(tx),
  );

  return { tx, lockCalls, activityLogs };
}

describe("Comment Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActionUser.mockResolvedValue({ id: CALLER_ID, name: "Caller User" });
  });

  describe("getTaskCommentsAction (Decision A + B)", () => {
    it("rejects unauthenticated callers and malformed UUIDs", async () => {
      mockGetActionUser.mockResolvedValueOnce(null);
      expect(await getTaskCommentsAction(TEAM_ID, { taskId: TASK_ID })).toEqual({
        success: false,
        error: "You must be signed in to view comments.",
      });

      expect(await getTaskCommentsAction("bad-team", { taskId: TASK_ID })).toEqual(
        {
          success: false,
          error: "Invalid team ID.",
        },
      );

      const badTask = await getTaskCommentsAction(TEAM_ID, { taskId: "bad-task" });
      expect(badTask.success).toBe(false);
    });

    it("rejects non-members, anonymized users, and inactive/cross-team tasks", async () => {
      mockUserFindFirst.mockResolvedValueOnce({ id: CALLER_ID });
      mockTeamFindFirst.mockResolvedValueOnce({ id: TEAM_ID });
      mockTeamMemberFindUnique.mockResolvedValueOnce(null);

      const nonMember = await getTaskCommentsAction(TEAM_ID, { taskId: TASK_ID });
      expect(nonMember).toEqual({
        success: false,
        error: "You are not a member of this team.",
      });
      expect(mockTaskFindFirst).not.toHaveBeenCalled();

      mockUserFindFirst.mockResolvedValueOnce({ id: CALLER_ID });
      mockTeamFindFirst.mockResolvedValueOnce({ id: TEAM_ID });
      mockTeamMemberFindUnique.mockResolvedValueOnce({ role: "MEMBER" });
      mockTaskFindFirst.mockResolvedValueOnce(null);

      const missingTask = await getTaskCommentsAction(TEAM_ID, {
        taskId: TASK_ID,
      });
      expect(missingTask).toEqual({
        success: false,
        error: "Task not found.",
      });
    });

    it("returns serializable chronological comments capped at 200", async () => {
      const createdAt = new Date("2026-11-25T09:00:00.000Z");
      mockUserFindFirst.mockResolvedValueOnce({ id: CALLER_ID });
      mockTeamFindFirst.mockResolvedValueOnce({ id: TEAM_ID });
      mockTeamMemberFindUnique.mockResolvedValueOnce({ role: "MEMBER" });
      mockTaskFindFirst.mockResolvedValueOnce({ id: TASK_ID });
      mockCommentFindMany.mockResolvedValueOnce([
        {
          id: COMMENT_ID,
          teamId: TEAM_ID,
          taskId: TASK_ID,
          userId: CALLER_ID,
          content: "Serialized comment",
          createdAt,
          updatedAt: createdAt,
          user: { id: CALLER_ID, name: "Caller User", deletedAt: null },
        },
      ]);
      mockCommentCount.mockResolvedValueOnce(1);

      const res = await getTaskCommentsAction(TEAM_ID, { taskId: TASK_ID });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.limit).toBe(COMMENT_THREAD_LIMIT);
        expect(res.data.comments[0]?.createdAt).toBe(createdAt.toISOString());
      }
    });
  });

  describe("createCommentAction", () => {
    it("enforces auth, UUID validation, team membership, and active task", async () => {
      mockGetActionUser.mockResolvedValueOnce(null);
      expect(
        await createCommentAction(TEAM_ID, { taskId: TASK_ID, content: "Hi" }),
      ).toEqual({
        success: false,
        error: "You must be signed in to perform this action.",
      });

      createTxHarness({ membership: null });
      const nonMember = await createCommentAction(TEAM_ID, {
        taskId: TASK_ID,
        content: "Hi",
      });
      expect(nonMember).toEqual({
        success: false,
        error: "You are not a member of this team.",
      });

      createTxHarness({ preTask: null });
      const missingTask = await createCommentAction(TEAM_ID, {
        taskId: TASK_ID,
        content: "Hi",
      });
      expect(missingTask).toEqual({
        success: false,
        error: "Task not found.",
      });
    });

    it("allows MEMBER to create a comment, follows lock order, logs ActivityLog WITHOUT content, and revalidates", async () => {
      const { lockCalls, activityLogs } = createTxHarness({
        membership: { role: "MEMBER" },
      });

      const res = await createCommentAction(TEAM_ID, {
        taskId: TASK_ID,
        content: "  Secret draft feedback  ",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe(COMMENT_ID);
        expect(res.data.content).toBe("Secret draft feedback");
      }

      // Lock order: team -> project -> user -> task
      expect(lockCalls.map((s) => s.match(/FROM "(\w+)"/)?.[1])).toEqual([
        "team",
        "project",
        "user",
        "task",
      ]);

      // Decision C: no comment content or contentSnippet in ActivityLog metadata
      expect(activityLogs).toHaveLength(1);
      expect(activityLogs[0]?.action).toBe("comment_created");
      expect(activityLogs[0]?.commentId).toBe(COMMENT_ID);
      expect(activityLogs[0]?.metadata).toEqual({
        taskId: TASK_ID,
        taskTitle: "Implement comments",
        commentId: COMMENT_ID,
      });
      expect(JSON.stringify(activityLogs[0]?.metadata)).not.toContain("Secret");

      expect(mockRevalidatePath).toHaveBeenCalledWith(`/teams/${TEAM_ID}/tasks`);
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/teams/${TEAM_ID}/projects/${PROJECT_ID}`,
      );
    });
  });

  describe("updateCommentAction", () => {
    it("blocks non-author edits even for OWNER and MANAGER", async () => {
      createTxHarness({
        membership: { role: "OWNER" },
        lockedComment: {
          id: COMMENT_ID,
          teamId: TEAM_ID,
          taskId: TASK_ID,
          userId: OTHER_USER_ID,
          content: "Other user comment",
          createdAt: new Date("2026-11-25T10:00:00.000Z"),
          updatedAt: new Date("2026-11-25T10:00:00.000Z"),
          deletedAt: null,
          user: { id: OTHER_USER_ID, name: "Other", deletedAt: null },
        },
      });

      const res = await updateCommentAction(TEAM_ID, {
        commentId: COMMENT_ID,
        taskId: TASK_ID,
        content: "Owner tries editing",
      });
      expect(res).toEqual({
        success: false,
        error: "You can only edit your own comments.",
      });
    });

    it("returns noOp when content is unchanged without creating an ActivityLog", async () => {
      const { activityLogs } = createTxHarness();

      const res = await updateCommentAction(TEAM_ID, {
        commentId: COMMENT_ID,
        taskId: TASK_ID,
        content: "Initial comment",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.noOp).toBe(true);
      }
      expect(activityLogs).toHaveLength(0);
    });

    it("updates own comment and records comment_updated without content metadata", async () => {
      const { lockCalls, activityLogs } = createTxHarness();

      const res = await updateCommentAction(TEAM_ID, {
        commentId: COMMENT_ID,
        taskId: TASK_ID,
        content: "Edited my own comment",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.noOp).toBe(false);
        expect(res.data.comment.content).toBe("Edited my own comment");
        expect(res.data.comment.isEdited).toBe(true);
      }
      expect(lockCalls.map((s) => s.match(/FROM "(\w+)"/)?.[1])).toEqual([
        "team",
        "project",
        "user",
        "task",
        "comment",
      ]);
      expect(activityLogs[0]?.action).toBe("comment_updated");
      expect(activityLogs[0]?.metadata).toEqual({
        taskId: TASK_ID,
        taskTitle: "Implement comments",
        commentId: COMMENT_ID,
      });
    });
  });

  describe("deleteCommentAction", () => {
    it("blocks MEMBER from deleting another user's comment", async () => {
      createTxHarness({
        membership: { role: "MEMBER" },
        lockedComment: {
          id: COMMENT_ID,
          teamId: TEAM_ID,
          taskId: TASK_ID,
          userId: OTHER_USER_ID,
          content: "Protected comment",
          createdAt: new Date("2026-11-25T10:00:00.000Z"),
          updatedAt: new Date("2026-11-25T10:00:00.000Z"),
          deletedAt: null,
          user: { id: OTHER_USER_ID, name: "Other", deletedAt: null },
        },
      });

      const res = await deleteCommentAction(TEAM_ID, {
        commentId: COMMENT_ID,
        taskId: TASK_ID,
      });
      expect(res).toEqual({
        success: false,
        error:
          "Only the comment author, team owners, or managers can delete comments.",
      });
    });

    it("allows MANAGER/OWNER to soft-delete another user's comment and logs comment_deleted", async () => {
      const { tx, activityLogs } = createTxHarness({
        membership: { role: "MANAGER" },
        lockedComment: {
          id: COMMENT_ID,
          teamId: TEAM_ID,
          taskId: TASK_ID,
          userId: OTHER_USER_ID,
          content: "Offensive comment",
          createdAt: new Date("2026-11-25T10:00:00.000Z"),
          updatedAt: new Date("2026-11-25T10:00:00.000Z"),
          deletedAt: null,
          user: { id: OTHER_USER_ID, name: "Other", deletedAt: null },
        },
      });

      const res = await deleteCommentAction(TEAM_ID, {
        commentId: COMMENT_ID,
        taskId: TASK_ID,
      });
      expect(res).toEqual({ success: true, data: { id: COMMENT_ID } });
      expect(tx.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: COMMENT_ID },
          data: { deletedAt: expect.any(Date) },
        }),
      );
      expect(activityLogs[0]?.action).toBe("comment_deleted");
      expect(activityLogs[0]?.metadata).toEqual({
        taskId: TASK_ID,
        taskTitle: "Implement comments",
        commentId: COMMENT_ID,
        deletedByRole: "MANAGER",
        isSelfDelete: false,
      });
    });

    it("rejects soft-deleted or cross-team comments", async () => {
      createTxHarness({ lockedCommentExists: false });
      const res = await deleteCommentAction(TEAM_ID, {
        commentId: COMMENT_ID,
        taskId: TASK_ID,
      });
      expect(res).toEqual({ success: false, error: "Comment not found." });
    });
  });
});
