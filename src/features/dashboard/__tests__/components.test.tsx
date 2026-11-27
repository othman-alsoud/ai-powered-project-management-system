import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/teams/11111111-1111-4111-8111-111111111111",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("@/features/tasks/actions", () => ({
  createTaskAction: vi.fn(),
  updateTaskAction: vi.fn(),
}));

import { DashboardHeaderActions } from "../components/dashboard-header-actions";
import { DashboardMetricsRow } from "../components/dashboard-metrics-row";
import { DashboardDistribution } from "../components/dashboard-distribution";
import { PrioritizedTaskStream } from "../components/prioritized-task-stream";
import { RecentActivityPanel } from "../components/recent-activity-panel";
import TeamDashboardLoading from "@/app/(dashboard)/teams/[teamId]/loading";
import TeamDashboardError from "@/app/(dashboard)/teams/[teamId]/error";
import type { ActivityLogItemDTO } from "@/features/activity/types";
import type { DashboardTaskItem } from "../utils";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("dashboard components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DashboardHeaderActions", () => {
    it("renders New Task CTA for OWNER and MANAGER when active projects exist", () => {
      const html = renderToString(
        React.createElement(DashboardHeaderActions, {
          teamId: TEAM_ID,
          role: "MANAGER",
          taskFormOptions: {
            projects: [{ id: PROJECT_ID, name: "Core", status: "ACTIVE" }],
            members: [
              { id: USER_ID, name: "Alice", email: "a@example.com", role: "OWNER" },
            ],
          },
        }),
      );

      expect(html).toContain("New Task");
    });

    it("renders Create a Project First link when OWNER/MANAGER has no projects", () => {
      const html = renderToString(
        React.createElement(DashboardHeaderActions, {
          teamId: TEAM_ID,
          role: "OWNER",
          taskFormOptions: {
            projects: [],
            members: [],
          },
        }),
      );

      expect(html).toContain("Create a Project First");
      expect(html).toContain(`/teams/${TEAM_ID}/projects`);
    });

    it("hides New Task CTA for MEMBER role", () => {
      const html = renderToString(
        React.createElement(DashboardHeaderActions, {
          teamId: TEAM_ID,
          role: "MEMBER",
          taskFormOptions: null,
        }),
      );

      expect(html).toBe("");
    });
  });

  describe("DashboardMetricsRow", () => {
    it("renders all 4 stat widgets and deep links to filtered views", () => {
      const html = renderToString(
        React.createElement(DashboardMetricsRow, {
          teamId: TEAM_ID,
          currentUserId: USER_ID,
          metrics: {
            activeProjectsCount: 3,
            totalProjectsCount: 5,
            myTasksCount: 7,
            inReviewCount: 2,
            dueThisWeekCount: 4,
          },
        }),
      );

      expect(html).toContain("Active Projects");
      expect(html).toContain("of 5 total");
      expect(html).toContain("My Tasks");
      expect(html).toContain("In Review");
      expect(html).toContain("Due This Week");
      expect(html).toContain(`/teams/${TEAM_ID}/projects`);
      expect(html).toContain(`/teams/${TEAM_ID}/tasks?assignee=${USER_ID}`);
      expect(html).toContain(`/teams/${TEAM_ID}/tasks?status=IN_REVIEW`);
      expect(html).toContain(`/teams/${TEAM_ID}/tasks?due=this_week`);
    });
  });

  describe("DashboardDistribution", () => {
    it("renders status distribution and open-task priority breakdown", () => {
      const html = renderToString(
        React.createElement(DashboardDistribution, {
          totalTasksCount: 10,
          totalOpenTasksCount: 6,
          statusBreakdown: [
            { status: "TODO", label: "To Do", count: 3, percentage: 30 },
            { status: "IN_PROGRESS", label: "In Progress", count: 2, percentage: 20 },
            { status: "IN_REVIEW", label: "In Review", count: 1, percentage: 10 },
            { status: "DONE", label: "Done", count: 4, percentage: 40 },
          ],
          priorityBreakdown: [
            { priority: "HIGH", label: "High", count: 3, percentage: 50 },
            { priority: "MEDIUM", label: "Medium", count: 2, percentage: 33 },
            { priority: "LOW", label: "Low", count: 1, percentage: 17 },
          ],
        }),
      );

      expect(html).toContain("Status Distribution");
      expect(html).toContain("Priority Breakdown");
      expect(html).toContain("10 total");
      expect(html).toContain("6 open");
      expect(html).toContain("To Do");
      expect(html).toContain("High");
    });
  });

  describe("PrioritizedTaskStream", () => {
    it("renders prioritized tasks with overdue warning and handles empty/unassigned states", () => {
      const refDate = new Date("2026-11-26T12:00:00.000Z");
      const tasks: DashboardTaskItem[] = [
        {
          id: "t-1",
          teamId: TEAM_ID,
          projectId: PROJECT_ID,
          title: "Patch overdue query",
          status: "IN_PROGRESS",
          priority: "HIGH",
          dueDate: new Date("2026-11-25T00:00:00.000Z"),
          createdAt: new Date("2026-11-20T10:00:00.000Z"),
          project: { id: PROJECT_ID, name: "Backend" },
          assignee: null,
        },
      ];

      const html = renderToString(
        React.createElement(PrioritizedTaskStream, {
          teamId: TEAM_ID,
          tasks,
          referenceDate: refDate,
        }),
      );

      expect(html).toContain("Patch overdue query");
      expect(html).toContain("Backend");
      expect(html).toContain("Unassigned");
      expect(html).toContain("Overdue");
      expect(html).toContain(`/teams/${TEAM_ID}/projects/${PROJECT_ID}`);

      const emptyHtml = renderToString(
        React.createElement(PrioritizedTaskStream, {
          teamId: TEAM_ID,
          tasks: [],
          referenceDate: refDate,
        }),
      );

      expect(emptyHtml).toContain("No open tasks");
    });
  });

  describe("RecentActivityPanel", () => {
    it("renders recent activity items and View all activity link, plus empty state", () => {
      const items: ActivityLogItemDTO[] = [
        {
          id: "act-1",
          teamId: TEAM_ID,
          action: "task_created",
          createdAt: "2026-11-26T10:00:00.000Z",
          actor: { id: USER_ID, name: "Alice", image: null, isDeleted: false },
          project: { id: PROJECT_ID, label: "Backend", isDeleted: false },
          task: { id: "t-1", label: "Patch overdue query", isDeleted: false },
          commentId: null,
          details: { taskTitle: "Patch overdue query" },
        },
      ];

      const html = renderToString(
        React.createElement(RecentActivityPanel, {
          teamId: TEAM_ID,
          items,
        }),
      );

      expect(html).toContain("Recent Activity");
      expect(html).toContain("Patch overdue query");
      expect(html).toContain(`/teams/${TEAM_ID}/activity`);
      expect(html).toContain("View all activity");

      const emptyHtml = renderToString(
        React.createElement(RecentActivityPanel, {
          teamId: TEAM_ID,
          items: [],
        }),
      );

      expect(emptyHtml).toContain("No recent activity");
    });
  });

  describe("loading and error route boundaries", () => {
    it("renders accessible loading skeleton and plain-language error state", () => {
      const loadingHtml = renderToString(React.createElement(TeamDashboardLoading));
      expect(loadingHtml).toContain('aria-busy="true"');

      const errorHtml = renderToString(
        React.createElement(TeamDashboardError, {
          error: new Error("Internal database detail should stay hidden"),
          reset: vi.fn(),
        }),
      );
      expect(errorHtml).toContain("Try again");
      expect(errorHtml).not.toContain("Internal database detail");
    });
  });
});
