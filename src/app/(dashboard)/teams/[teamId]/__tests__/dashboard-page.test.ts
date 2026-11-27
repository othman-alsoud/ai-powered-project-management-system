import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/teams/team-123",
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

vi.mock("@/features/dashboard/server", () => ({
  getTeamDashboardData: vi.fn(),
}));

import { getTeamDashboardData } from "@/features/dashboard/server";
import TeamDashboardPage from "../page";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("TeamDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads team dashboard summary via getTeamDashboardData and renders metrics, distribution, task stream, and recent activity", async () => {
    vi.mocked(getTeamDashboardData).mockResolvedValueOnce({
      team: {
        id: TEAM_ID,
        name: "Core Engineering",
        description: "Building the future",
      },
      currentUser: {
        id: USER_ID,
        name: "Alice",
      },
      role: "OWNER",
      metrics: {
        activeProjectsCount: 2,
        totalProjectsCount: 3,
        myTasksCount: 4,
        inReviewCount: 1,
        dueThisWeekCount: 2,
      },
      statusBreakdown: [
        { status: "TODO", label: "To Do", count: 2, percentage: 40 },
        { status: "IN_PROGRESS", label: "In Progress", count: 1, percentage: 20 },
        { status: "IN_REVIEW", label: "In Review", count: 1, percentage: 20 },
        { status: "DONE", label: "Done", count: 1, percentage: 20 },
      ],
      totalTasksCount: 5,
      priorityBreakdown: [
        { priority: "HIGH", label: "High", count: 2, percentage: 50 },
        { priority: "MEDIUM", label: "Medium", count: 1, percentage: 25 },
        { priority: "LOW", label: "Low", count: 1, percentage: 25 },
      ],
      totalOpenTasksCount: 4,
      prioritizedTasks: [
        {
          id: "t-1",
          teamId: TEAM_ID,
          projectId: PROJECT_ID,
          title: "Prepare milestone release",
          status: "IN_REVIEW",
          priority: "HIGH",
          dueDate: new Date("2026-11-27T00:00:00.000Z"),
          createdAt: new Date("2026-11-22T10:00:00.000Z"),
          project: { id: PROJECT_ID, name: "Core Platform" },
          assignee: { id: USER_ID, name: "Alice", image: null },
        },
      ],
      recentActivity: [],
      taskFormOptions: {
        projects: [{ id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" }],
        members: [
          { id: USER_ID, name: "Alice", email: "alice@example.com", role: "OWNER" },
        ],
      },
      referenceDate: new Date("2026-11-26T12:00:00.000Z"),
    });

    const jsx = await TeamDashboardPage({
      params: Promise.resolve({ teamId: TEAM_ID }),
    });
    const html = renderToString(jsx);

    expect(getTeamDashboardData).toHaveBeenCalledWith(TEAM_ID);
    expect(html).toContain("Dashboard / Core Engineering");
    expect(html).toContain("Active Projects");
    expect(html).toContain("Status Distribution");
    expect(html).toContain("Priority Breakdown");
    expect(html).toContain("Prepare milestone release");
    expect(html).toContain("New Task");
    expect(html).toContain("View all activity");
  });

  it("propagates notFound error for unauthorized or cross-team access", async () => {
    vi.mocked(getTeamDashboardData).mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));

    await expect(
      TeamDashboardPage({
        params: Promise.resolve({ teamId: TEAM_ID }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
