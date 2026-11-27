import { describe, expect, it } from "vitest";
import {
  buildPriorityBreakdown,
  buildStatusBreakdown,
  sortDashboardPrioritizedTasks,
  type DashboardTaskItem,
} from "../utils";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

function makeDashboardTask(
  overrides: Partial<DashboardTaskItem> & { id: string },
): DashboardTaskItem {
  return {
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: `Task ${overrides.id}`,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    createdAt: new Date("2026-11-20T10:00:00.000Z"),
    project: { id: PROJECT_ID, name: "Core Platform" },
    assignee: null,
    ...overrides,
  };
}

describe("dashboard utils", () => {
  describe("buildStatusBreakdown", () => {
    it("computes counts, percentages, totalTasks, and inReviewCount across all 4 statuses", () => {
      const result = buildStatusBreakdown([
        { status: "TODO", count: 4 },
        { status: "IN_PROGRESS", count: 2 },
        { status: "IN_REVIEW", count: 1 },
        { status: "DONE", count: 3 },
      ]);

      expect(result.totalTasks).toBe(10);
      expect(result.inReviewCount).toBe(1);
      expect(result.items).toEqual([
        { status: "TODO", label: "To Do", count: 4, percentage: 40 },
        { status: "IN_PROGRESS", label: "In Progress", count: 2, percentage: 20 },
        { status: "IN_REVIEW", label: "In Review", count: 1, percentage: 10 },
        { status: "DONE", label: "Done", count: 3, percentage: 30 },
      ]);
    });

    it("handles empty status counts safely with 0% percentages", () => {
      const result = buildStatusBreakdown([]);

      expect(result.totalTasks).toBe(0);
      expect(result.inReviewCount).toBe(0);
      expect(result.items.every((item) => item.count === 0 && item.percentage === 0)).toBe(
        true,
      );
    });
  });

  describe("buildPriorityBreakdown", () => {
    it("orders HIGH -> MEDIUM -> LOW for open tasks", () => {
      const result = buildPriorityBreakdown([
        { priority: "LOW", count: 1 },
        { priority: "HIGH", count: 3 },
      ]);

      expect(result.totalOpenTasks).toBe(4);
      expect(result.items).toEqual([
        { priority: "HIGH", label: "High", count: 3, percentage: 75 },
        { priority: "MEDIUM", label: "Medium", count: 0, percentage: 0 },
        { priority: "LOW", label: "Low", count: 1, percentage: 25 },
      ]);
    });
  });

  describe("sortDashboardPrioritizedTasks", () => {
    it("sorts overdue first, then earliest dueDate, then HIGH->MEDIUM->LOW, newest createdAt, and id ascending, with null dueDate last", () => {
      // Reference: Thursday 2026-11-26T12:00:00Z -> todayStart is 2026-11-26T00:00:00Z
      const ref = new Date("2026-11-26T12:00:00.000Z");

      const dueTodayLow = makeDashboardTask({
        id: "task-today-low",
        dueDate: new Date("2026-11-26T00:00:00.000Z"),
        priority: "LOW",
      });
      const overdueLaterMedium = makeDashboardTask({
        id: "task-overdue-2",
        dueDate: new Date("2026-11-25T00:00:00.000Z"),
        priority: "MEDIUM",
      });
      const overdueEarlierLow = makeDashboardTask({
        id: "task-overdue-1",
        dueDate: new Date("2026-11-24T00:00:00.000Z"),
        priority: "LOW",
      });
      const dueTomorrowHigh = makeDashboardTask({
        id: "task-tomorrow-high",
        dueDate: new Date("2026-11-27T00:00:00.000Z"),
        priority: "HIGH",
      });
      const noDueHighOlder = makeDashboardTask({
        id: "task-nodue-b",
        dueDate: null,
        priority: "HIGH",
        createdAt: new Date("2026-11-19T10:00:00.000Z"),
      });
      const noDueHighNewer = makeDashboardTask({
        id: "task-nodue-a",
        dueDate: null,
        priority: "HIGH",
        createdAt: new Date("2026-11-25T10:00:00.000Z"),
      });
      const noDueLow = makeDashboardTask({
        id: "task-nodue-low",
        dueDate: null,
        priority: "LOW",
      });
      const tieSameDateSamePriorityA = makeDashboardTask({
        id: "aaa",
        dueDate: new Date("2026-11-27T00:00:00.000Z"),
        priority: "HIGH",
        createdAt: new Date("2026-11-20T10:00:00.000Z"),
      });

      const sorted = sortDashboardPrioritizedTasks(
        [
          noDueLow,
          dueTomorrowHigh,
          noDueHighOlder,
          dueTodayLow,
          overdueLaterMedium,
          noDueHighNewer,
          tieSameDateSamePriorityA,
          overdueEarlierLow,
        ],
        ref,
      );

      expect(sorted.map((t) => t.id)).toEqual([
        "task-overdue-1",
        "task-overdue-2",
        "task-today-low",
        "aaa",
        "task-tomorrow-high",
        "task-nodue-a",
        "task-nodue-b",
        "task-nodue-low",
      ]);
    });
  });
});
