import { describe, expect, it } from "vitest";
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_LIST_PAGE_SIZE,
  TASK_SEARCH_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  createTaskSchema,
  deleteTaskSchema,
  getUtcDueDateBoundaries,
  hasActiveTaskFilters,
  isTaskOverdue,
  isValidUuid,
  parseTaskQueryParams,
  taskFieldErrorsFromZod,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "../validation";

const VALID_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const VALID_TASK_ID = "22222222-2222-4222-8222-222222222222";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";

describe("task validation schemas", () => {
  describe("isValidUuid", () => {
    it("accepts valid UUIDs and rejects malformed strings", () => {
      expect(isValidUuid(VALID_PROJECT_ID)).toBe(true);
      expect(isValidUuid("not-a-uuid")).toBe(false);
      expect(isValidUuid("")).toBe(false);
    });
  });

  describe("createTaskSchema", () => {
    it("applies defaults and normalizes blank optional fields to null", () => {
      const parsed = createTaskSchema.parse({
        projectId: `  ${VALID_PROJECT_ID} `,
        title: "  Build task list UI  ",
        description: "   ",
        dueDate: "",
        assignedToId: " ",
      });

      expect(parsed).toEqual({
        projectId: VALID_PROJECT_ID,
        title: "Build task list UI",
        description: null,
        status: "TODO",
        priority: "MEDIUM",
        dueDate: null,
        assignedToId: null,
      });
    });

    it("accepts explicit status, priority, assignee, and valid UTC YYYY-MM-DD dueDate", () => {
      const parsed = createTaskSchema.parse({
        projectId: VALID_PROJECT_ID,
        title: "Write server action locks",
        description: "Lock team -> project -> users -> task",
        status: "IN_REVIEW",
        priority: "HIGH",
        dueDate: "2026-12-31",
        assignedToId: VALID_USER_ID,
      });

      expect(parsed.status).toBe("IN_REVIEW");
      expect(parsed.priority).toBe("HIGH");
      expect(parsed.assignedToId).toBe(VALID_USER_ID);
      expect(parsed.dueDate).toBeInstanceOf(Date);
      expect(parsed.dueDate?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    });

    it("rejects empty title, oversized title/description, invalid projectId, and invalid calendar dates", () => {
      const result = createTaskSchema.safeParse({
        projectId: "bad-project-id",
        title: "   ",
        description: "a".repeat(TASK_DESCRIPTION_MAX_LENGTH + 1),
        dueDate: "2026-02-30",
        assignedToId: "bad-user-id",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = taskFieldErrorsFromZod(result.error);
        expect(errors.projectId).toBeDefined();
        expect(errors.title).toBeDefined();
        expect(errors.description).toBeDefined();
        expect(errors.dueDate).toBeDefined();
        expect(errors.assignedToId).toBeDefined();
      }
    });

    it("rejects title exceeding max length", () => {
      const result = createTaskSchema.safeParse({
        projectId: VALID_PROJECT_ID,
        title: "t".repeat(TASK_TITLE_MAX_LENGTH + 1),
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updateTaskSchema", () => {
    it("preserves omitted fields as undefined while allowing explicit null resets", () => {
      const partial = updateTaskSchema.parse({
        taskId: VALID_TASK_ID,
        title: "  Updated title ",
      });

      expect(partial.taskId).toBe(VALID_TASK_ID);
      expect(partial.title).toBe("Updated title");
      expect(partial.description).toBeUndefined();
      expect(partial.dueDate).toBeUndefined();
      expect(partial.assignedToId).toBeUndefined();
      expect(partial.status).toBeUndefined();
      expect(partial.priority).toBeUndefined();
      expect(partial.projectId).toBeUndefined();

      const cleared = updateTaskSchema.parse({
        taskId: VALID_TASK_ID,
        description: "",
        dueDate: null,
        assignedToId: "",
      });

      expect(cleared.description).toBeNull();
      expect(cleared.dueDate).toBeNull();
      expect(cleared.assignedToId).toBeNull();
    });

    it("rejects invalid taskId, invalid status, or non-YYYY-MM-DD dueDate", () => {
      const result = updateTaskSchema.safeParse({
        taskId: "bad",
        status: "ARCHIVED",
        dueDate: "11/24/2026",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updateTaskStatusSchema & deleteTaskSchema", () => {
    it("validates status change payload", () => {
      expect(
        updateTaskStatusSchema.parse({
          taskId: VALID_TASK_ID,
          status: "DONE",
        }),
      ).toEqual({
        taskId: VALID_TASK_ID,
        status: "DONE",
      });

      expect(
        updateTaskStatusSchema.safeParse({
          taskId: VALID_TASK_ID,
          status: "INVALID",
        }).success,
      ).toBe(false);
    });

    it("validates delete payload", () => {
      expect(deleteTaskSchema.parse({ taskId: VALID_TASK_ID })).toEqual({
        taskId: VALID_TASK_ID,
      });
      expect(deleteTaskSchema.safeParse({ taskId: "nope" }).success).toBe(false);
    });
  });

  describe("isTaskOverdue", () => {
    it("compares strictly by UTC calendar date and excludes DONE tasks", () => {
      const ref = new Date("2026-11-24T23:59:00.000Z");

      expect(
        isTaskOverdue(new Date("2026-11-23T00:00:00.000Z"), "TODO", ref),
      ).toBe(true);
      expect(
        isTaskOverdue(new Date("2026-11-24T00:00:00.000Z"), "IN_PROGRESS", ref),
      ).toBe(false);
      expect(
        isTaskOverdue(new Date("2026-11-23T00:00:00.000Z"), "DONE", ref),
      ).toBe(false);
      expect(isTaskOverdue(null, "TODO", ref)).toBe(false);
    });
  });

  describe("parseTaskQueryParams & getUtcDueDateBoundaries", () => {
    it("uses 25 as the fixed list page size and defaults cleanly on empty or invalid params", () => {
      expect(TASK_LIST_PAGE_SIZE).toBe(25);

      expect(parseTaskQueryParams({})).toEqual({
        view: "board",
        q: undefined,
        status: undefined,
        priority: undefined,
        assignee: undefined,
        due: undefined,
        sort: "createdAt",
        dir: "desc",
        page: 1,
      });

      expect(
        parseTaskQueryParams({
          view: "unknown",
          q: "   ",
          status: "BAD",
          priority: "URGENT",
          assignee: "not-a-uuid",
          due: "next_month",
          sort: "random",
          dir: "sideways",
          page: "-5",
        }),
      ).toEqual({
        view: "board",
        q: undefined,
        status: undefined,
        priority: undefined,
        assignee: undefined,
        due: undefined,
        sort: "createdAt",
        dir: "desc",
        page: 1,
      });
    });

    it("parses valid query criteria, clamps search length, keeps page only in list view, and honors sort defaults", () => {
      const longQuery = "a".repeat(TASK_SEARCH_MAX_LENGTH + 25);
      const listParsed = parseTaskQueryParams({
        view: "list",
        q: `  ${longQuery}  `,
        status: "IN_REVIEW",
        priority: "HIGH",
        assignee: VALID_USER_ID,
        due: "this_week",
        sort: "dueDate",
        page: "3",
      });

      expect(listParsed).toEqual({
        view: "list",
        q: "a".repeat(TASK_SEARCH_MAX_LENGTH),
        status: "IN_REVIEW",
        priority: "HIGH",
        assignee: VALID_USER_ID,
        due: "this_week",
        sort: "dueDate",
        dir: "asc",
        page: 3,
      });

      const unassignedBoard = parseTaskQueryParams({
        view: "board",
        assignee: "unassigned",
        page: "4",
      });
      expect(unassignedBoard.assignee).toBe("unassigned");
      expect(unassignedBoard.page).toBe(1);

      expect(hasActiveTaskFilters(listParsed)).toBe(true);
      expect(hasActiveTaskFilters(parseTaskQueryParams({ view: "list", sort: "title" }))).toBe(false);
    });

    it("computes UTC Monday-Sunday calendar boundaries for overdue, today, and this_week", () => {
      // Tuesday 2026-11-24 UTC -> Sunday is 2026-11-29 23:59:59.999 UTC
      const tuesday = new Date("2026-11-24T15:30:00.000Z");
      expect(getUtcDueDateBoundaries("overdue", tuesday)).toEqual({
        lt: new Date("2026-11-24T00:00:00.000Z"),
        excludeDone: true,
      });
      expect(getUtcDueDateBoundaries("today", tuesday)).toEqual({
        gte: new Date("2026-11-24T00:00:00.000Z"),
        lt: new Date("2026-11-25T00:00:00.000Z"),
        excludeDone: false,
      });
      expect(getUtcDueDateBoundaries("this_week", tuesday)).toEqual({
        gte: new Date("2026-11-24T00:00:00.000Z"),
        lte: new Date("2026-11-29T23:59:59.999Z"),
        excludeDone: false,
      });

      // Sunday 2026-11-29 UTC -> ends same Sunday 23:59:59.999 UTC
      const sunday = new Date("2026-11-29T08:00:00.000Z");
      expect(getUtcDueDateBoundaries("this_week", sunday)).toEqual({
        gte: new Date("2026-11-29T00:00:00.000Z"),
        lte: new Date("2026-11-29T23:59:59.999Z"),
        excludeDone: false,
      });
    });
  });
});
