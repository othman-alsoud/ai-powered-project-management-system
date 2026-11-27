import { describe, expect, it } from "vitest";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_THREAD_LIMIT,
  commentFieldErrorsFromZod,
  createCommentSchema,
  deleteCommentSchema,
  formatUtcCommentTimestamp,
  isValidUuid,
  loadTaskCommentsSchema,
  updateCommentSchema,
} from "../validation";

const TASK_ID = "44444444-4444-4444-8444-444444444444";
const COMMENT_ID = "55555555-5555-4555-8555-555555555555";

describe("Comment validation", () => {
  it("exports expected bounds constants", () => {
    expect(COMMENT_MAX_LENGTH).toBe(2000);
    expect(COMMENT_THREAD_LIMIT).toBe(200);
  });

  it("validates UUID strings consistently", () => {
    expect(isValidUuid(TASK_ID)).toBe(true);
    expect(isValidUuid("  " + COMMENT_ID + "  ")).toBe(true);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });

  describe("loadTaskCommentsSchema", () => {
    it("accepts a valid task UUID", () => {
      const parsed = loadTaskCommentsSchema.safeParse({ taskId: TASK_ID });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.taskId).toBe(TASK_ID);
      }
    });

    it("rejects malformed taskId", () => {
      const parsed = loadTaskCommentsSchema.safeParse({ taskId: "bad-id" });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(commentFieldErrorsFromZod(parsed.error).taskId?.[0]).toContain(
          "Invalid task ID",
        );
      }
    });
  });

  describe("createCommentSchema", () => {
    it("trims whitespace and accepts valid comment content", () => {
      const parsed = createCommentSchema.safeParse({
        taskId: TASK_ID,
        content: "  Looks good to ship!  ",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toEqual({
          taskId: TASK_ID,
          content: "Looks good to ship!",
        });
      }
    });

    it("rejects empty or whitespace-only comment content", () => {
      const empty = createCommentSchema.safeParse({
        taskId: TASK_ID,
        content: "   \n\t  ",
      });
      expect(empty.success).toBe(false);
      if (!empty.success) {
        expect(commentFieldErrorsFromZod(empty.error).content?.[0]).toContain(
          "empty",
        );
      }
    });

    it("accepts exactly COMMENT_MAX_LENGTH trimmed characters and rejects longer content", () => {
      const exact = createCommentSchema.safeParse({
        taskId: TASK_ID,
        content: `  ${"a".repeat(COMMENT_MAX_LENGTH)}  `,
      });
      expect(exact.success).toBe(true);

      const tooLong = createCommentSchema.safeParse({
        taskId: TASK_ID,
        content: "a".repeat(COMMENT_MAX_LENGTH + 1),
      });
      expect(tooLong.success).toBe(false);
      if (!tooLong.success) {
        expect(commentFieldErrorsFromZod(tooLong.error).content?.[0]).toContain(
          String(COMMENT_MAX_LENGTH),
        );
      }
    });
  });

  describe("updateCommentSchema", () => {
    it("requires valid commentId, taskId, and trimmed content", () => {
      const parsed = updateCommentSchema.safeParse({
        commentId: COMMENT_ID,
        taskId: TASK_ID,
        content: "  Updated note  ",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.content).toBe("Updated note");
      }

      const invalidId = updateCommentSchema.safeParse({
        commentId: "bad",
        taskId: TASK_ID,
        content: "Valid",
      });
      expect(invalidId.success).toBe(false);
      if (!invalidId.success) {
        expect(
          commentFieldErrorsFromZod(invalidId.error).commentId?.[0],
        ).toContain("Invalid comment ID");
      }
    });
  });

  describe("deleteCommentSchema", () => {
    it("requires valid commentId and taskId UUIDs", () => {
      const ok = deleteCommentSchema.safeParse({
        commentId: COMMENT_ID,
        taskId: TASK_ID,
      });
      expect(ok.success).toBe(true);

      const bad = deleteCommentSchema.safeParse({
        commentId: "bad",
        taskId: "bad",
      });
      expect(bad.success).toBe(false);
      if (!bad.success) {
        const errors = commentFieldErrorsFromZod(bad.error);
        expect(errors.commentId).toBeDefined();
        expect(errors.taskId).toBeDefined();
      }
    });
  });

  describe("formatUtcCommentTimestamp", () => {
    it("formats ISO timestamps in UTC and guards invalid values", () => {
      const formatted = formatUtcCommentTimestamp("2026-11-25T14:05:00.000Z");
      expect(formatted).toContain("Nov 25, 2026");
      expect(formatted).toContain("UTC");
      expect(formatUtcCommentTimestamp("invalid")).toBe("—");
      expect(formatUtcCommentTimestamp(null)).toBe("—");
    });
  });
});
