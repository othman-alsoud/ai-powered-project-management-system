import { describe, expect, it } from "vitest";
import type { TaskSummary } from "../server";
import {
  applyOptimisticTaskStatus,
  canUserMoveTask,
  compareKanbanTasks,
  groupTasksByStatus,
  makeKanbanTabDroppableId,
  parseTasksViewMode,
  resolveDragDropTargetStatus,
} from "../board-utils";
import { kanbanCollisionDetection } from "../components/task-kanban-board";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeTask(overrides: Partial<TaskSummary> & { id: string }): TaskSummary {
  return {
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: `Task ${overrides.id}`,
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    assignedToId: null,
    createdById: USER_A,
    updatedById: USER_A,
    createdAt: new Date("2026-11-20T00:00:00.000Z"),
    updatedAt: new Date("2026-11-20T00:00:00.000Z"),
    project: { id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" },
    assignee: null,
    createdBy: { id: USER_A, name: "Alice" },
    updatedBy: { id: USER_A, name: "Alice" },
    ...overrides,
  };
}

describe("board-utils", () => {
  describe("parseTasksViewMode", () => {
    it("defaults to board and accepts board/list from strings or arrays", () => {
      expect(parseTasksViewMode(undefined)).toBe("board");
      expect(parseTasksViewMode(null)).toBe("board");
      expect(parseTasksViewMode("")).toBe("board");
      expect(parseTasksViewMode("invalid")).toBe("board");
      expect(parseTasksViewMode("list")).toBe("list");
      expect(parseTasksViewMode("LIST")).toBe("list");
      expect(parseTasksViewMode(["list", "board"])).toBe("list");
      expect(parseTasksViewMode(["board"])).toBe("board");
    });
  });

  describe("compareKanbanTasks & groupTasksByStatus", () => {
    it("sorts by priority HIGH -> MEDIUM -> LOW, earliest non-null dueDate (nulls last), createdAt desc, id asc", () => {
      const tLowSoon = makeTask({
        id: "00000000-0000-4000-8000-000000000001",
        priority: "LOW",
        dueDate: new Date("2026-11-21T00:00:00.000Z"),
      });
      const tHighNullDue = makeTask({
        id: "00000000-0000-4000-8000-000000000002",
        priority: "HIGH",
        dueDate: null,
      });
      const tHighLaterDue = makeTask({
        id: "00000000-0000-4000-8000-000000000003",
        priority: "HIGH",
        dueDate: new Date("2026-12-10T00:00:00.000Z"),
      });
      const tHighEarlierDue = makeTask({
        id: "00000000-0000-4000-8000-000000000004",
        priority: "HIGH",
        dueDate: new Date("2026-11-25T00:00:00.000Z"),
      });
      const tMedOlder = makeTask({
        id: "00000000-0000-4000-8000-000000000005",
        priority: "MEDIUM",
        dueDate: new Date("2026-12-01T00:00:00.000Z"),
        createdAt: new Date("2026-11-18T00:00:00.000Z"),
      });
      const tMedNewerTieIdB = makeTask({
        id: "00000000-0000-4000-8000-00000000000b",
        priority: "MEDIUM",
        dueDate: new Date("2026-12-01T00:00:00.000Z"),
        createdAt: new Date("2026-11-22T00:00:00.000Z"),
      });
      const tMedNewerTieIdA = makeTask({
        id: "00000000-0000-4000-8000-00000000000a",
        priority: "MEDIUM",
        dueDate: new Date("2026-12-01T00:00:00.000Z"),
        createdAt: new Date("2026-11-22T00:00:00.000Z"),
      });

      const sorted = [
        tLowSoon,
        tHighNullDue,
        tMedOlder,
        tHighLaterDue,
        tMedNewerTieIdB,
        tHighEarlierDue,
        tMedNewerTieIdA,
      ].sort(compareKanbanTasks);

      expect(sorted.map((task) => task.id)).toEqual([
        tHighEarlierDue.id,
        tHighLaterDue.id,
        tHighNullDue.id,
        tMedNewerTieIdA.id,
        tMedNewerTieIdB.id,
        tMedOlder.id,
        tLowSoon.id,
      ]);
    });

    it("groups tasks into all four columns and ignores malformed statuses safely", () => {
      const grouped = groupTasksByStatus([
        makeTask({ id: "t1", status: "DONE" }),
        makeTask({ id: "t2", status: "IN_REVIEW" }),
        makeTask({ id: "t3", status: "TODO", priority: "LOW" }),
        makeTask({ id: "t4", status: "TODO", priority: "HIGH" }),
        makeTask({ id: "t5", status: "UNKNOWN_STATUS" as TaskSummary["status"] }),
      ]);

      expect(grouped.TODO.map((t) => t.id)).toEqual(["t4", "t3"]);
      expect(grouped.IN_PROGRESS).toEqual([]);
      expect(grouped.IN_REVIEW.map((t) => t.id)).toEqual(["t2"]);
      expect(grouped.DONE.map((t) => t.id)).toEqual(["t1"]);
    });

    it("handles malformed/invalid Date instances gracefully without NaN ordering instability", () => {
      const invalidDate = new Date("invalid");
      const valid = makeTask({
        id: "a",
        priority: "MEDIUM",
        dueDate: new Date("2026-12-01T00:00:00.000Z"),
      });
      const invalid = makeTask({
        id: "b",
        priority: "MEDIUM",
        dueDate: invalidDate,
      });

      const sorted = [invalid, valid].sort(compareKanbanTasks);
      expect(sorted.map((t) => t.id)).toEqual(["a", "b"]);
    });
  });

  describe("RBAC, optimistic transition & drop target resolution", () => {
    it("enforces OWNER/MANAGER any-task and MEMBER assigned-only movement rules", () => {
      const assignedToA = makeTask({ id: "t1", assignedToId: USER_A });
      const unassigned = makeTask({ id: "t2", assignedToId: null });

      expect(canUserMoveTask(unassigned, USER_A, "OWNER")).toBe(true);
      expect(canUserMoveTask(unassigned, USER_A, "MANAGER")).toBe(true);
      expect(canUserMoveTask(assignedToA, USER_A, "MEMBER")).toBe(true);
      expect(canUserMoveTask(assignedToA, USER_B, "MEMBER")).toBe(false);
      expect(canUserMoveTask(unassigned, USER_A, "MEMBER")).toBe(false);
    });

    it("updates only the target task status immutably", () => {
      const t1 = makeTask({ id: "t1", status: "TODO" });
      const t2 = makeTask({ id: "t2", status: "IN_PROGRESS" });

      const updated = applyOptimisticTaskStatus([t1, t2], "t1", "IN_REVIEW");
      expect(updated[0]?.status).toBe("IN_REVIEW");
      expect(updated[1]?.status).toBe("IN_PROGRESS");
      expect(t1.status).toBe("TODO");
    });

    it("resolves drop targets from column IDs, mobile tab IDs, raw statuses, or task IDs", () => {
      const tasks = [makeTask({ id: "task-1", status: "IN_REVIEW" })];

      expect(resolveDragDropTargetStatus("column:IN_PROGRESS", tasks)).toBe(
        "IN_PROGRESS",
      );
      expect(
        resolveDragDropTargetStatus(makeKanbanTabDroppableId("IN_REVIEW"), tasks),
      ).toBe("IN_REVIEW");
      expect(resolveDragDropTargetStatus("tab:DONE", tasks)).toBe("DONE");
      expect(resolveDragDropTargetStatus("DONE", tasks)).toBe("DONE");
      expect(resolveDragDropTargetStatus("task-1", tasks)).toBe("IN_REVIEW");
      expect(resolveDragDropTargetStatus("unknown", tasks)).toBeNull();
      expect(resolveDragDropTargetStatus(null, tasks)).toBeNull();
    });

    it("kanbanCollisionDetection ignores hidden 0x0 containers from inactive breakpoints", () => {
      const hiddenColumnRect = {
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
      };
      const visibleTabRect = {
        width: 160,
        height: 44,
        top: 200,
        left: 200,
        bottom: 244,
        right: 360,
      };

      const hiddenContainer = {
        id: "column:TODO",
        key: "column:TODO",
        data: { current: { status: "TODO" } },
        node: { current: null },
        rect: { current: hiddenColumnRect },
        disabled: false,
      };
      const visibleContainer = {
        id: "tab:IN_PROGRESS",
        key: "tab:IN_PROGRESS",
        data: { current: { status: "IN_PROGRESS" } },
        node: { current: null },
        rect: { current: visibleTabRect },
        disabled: false,
      };

      const collisions = kanbanCollisionDetection({
        active: {
          id: "task-1",
          data: { current: {} },
          rect: {
            current: {
              initial: visibleTabRect,
              translated: visibleTabRect,
            },
          },
        } as never,
        collisionRect: visibleTabRect as never,
        droppableRects: new Map([
          ["column:TODO", hiddenColumnRect as never],
          ["tab:IN_PROGRESS", visibleTabRect as never],
        ]),
        droppableContainers: [hiddenContainer as never, visibleContainer as never],
        pointerCoordinates: { x: 250, y: 220 },
      });

      expect(collisions.map((c) => c.id)).toEqual(["tab:IN_PROGRESS"]);
    });

    it("kanbanCollisionDetection anchors pointer/touch drags to pointerCoordinates even when dragging a wide card by its right-side handle", () => {
      const tabInReviewRect = {
        width: 167,
        height: 44,
        top: 305,
        left: 16,
        bottom: 349,
        right: 183,
      };
      const tabInProgressRect = {
        width: 167,
        height: 44,
        top: 253,
        left: 191,
        bottom: 297,
        right: 358,
      };
      const wideDraggedCardRect = {
        width: 320,
        height: 180,
        top: 230,
        left: 20,
        bottom: 410,
        right: 340,
      };

      const collisions = kanbanCollisionDetection({
        active: {
          id: "task-1",
          data: { current: {} },
          rect: {
            current: {
              initial: wideDraggedCardRect,
              translated: wideDraggedCardRect,
            },
          },
        } as never,
        collisionRect: wideDraggedCardRect as never,
        droppableRects: new Map([
          ["tab:IN_REVIEW", tabInReviewRect as never],
          ["tab:IN_PROGRESS", tabInProgressRect as never],
        ]),
        droppableContainers: [
          {
            id: "tab:IN_REVIEW",
            key: "tab:IN_REVIEW",
            data: { current: { status: "IN_REVIEW" } },
            node: { current: null },
            rect: { current: tabInReviewRect },
            disabled: false,
          } as never,
          {
            id: "tab:IN_PROGRESS",
            key: "tab:IN_PROGRESS",
            data: { current: { status: "IN_PROGRESS" } },
            node: { current: null },
            rect: { current: tabInProgressRect },
            disabled: false,
          } as never,
        ],
        // Pointer is just below #kanban-tab-IN_PROGRESS gap on the right side (x=275, y=300)
        pointerCoordinates: { x: 275, y: 300 },
      });

      expect(collisions[0]?.id).toBe("tab:IN_PROGRESS");
    });
  });
});
