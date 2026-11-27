import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
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

vi.mock("@/features/teams/server", () => ({
  requireTeamMember: vi.fn(),
}));

vi.mock("@/features/tasks/server", () => ({
  getTeamTasks: vi.fn(),
  getTeamTasksPageResult: vi.fn(),
  getTaskFormOptions: vi.fn(),
}));

import { requireTeamMember } from "@/features/teams/server";
import {
  getTaskFormOptions,
  getTeamTasksPageResult,
} from "@/features/tasks/server";
import TeamTasksPage from "../page";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const mockUser = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Alice Owner",
  email: "alice@example.com",
  emailVerified: true,
  image: null,
  lastActiveTeamId: TEAM_ID,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTeam = {
  id: TEAM_ID,
  name: "Platform Team",
  description: null,
  ownerId: mockUser.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe("TeamTasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies team membership, loads team tasks and options, and renders TasksManager", async () => {
    vi.mocked(requireTeamMember).mockResolvedValueOnce({
      user: mockUser,
      team: mockTeam,
      membership: {
        teamId: TEAM_ID,
        userId: mockUser.id,
        role: "OWNER",
        joinedAt: new Date(),
      },
      role: "OWNER",
    });
    vi.mocked(getTeamTasksPageResult).mockResolvedValueOnce({
      tasks: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          teamId: TEAM_ID,
          projectId: PROJECT_ID,
          title: "Verify lock safety",
          description: null,
          status: "TODO",
          priority: "HIGH",
          dueDate: new Date("2026-12-01T00:00:00.000Z"),
          assignedToId: mockUser.id,
          createdById: mockUser.id,
          updatedById: mockUser.id,
          createdAt: new Date("2026-11-24T00:00:00.000Z"),
          updatedAt: new Date("2026-11-24T00:00:00.000Z"),
          project: { id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" },
          assignee: { id: mockUser.id, name: mockUser.name, image: null },
          createdBy: { id: mockUser.id, name: mockUser.name },
          updatedBy: { id: mockUser.id, name: mockUser.name },
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    vi.mocked(getTaskFormOptions).mockResolvedValueOnce({
      projects: [{ id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" }],
      members: [
        {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: "OWNER",
        },
      ],
    });

    const jsx = await TeamTasksPage({
      params: Promise.resolve({ teamId: TEAM_ID }),
    });
    const html = renderToString(jsx as React.ReactElement);

    expect(requireTeamMember).toHaveBeenCalledWith(TEAM_ID);
    expect(getTeamTasksPageResult).toHaveBeenCalledWith(
      TEAM_ID,
      expect.objectContaining({ view: "board", page: 1 }),
    );
    expect(getTaskFormOptions).toHaveBeenCalledWith(TEAM_ID);
    expect(html).toContain("Verify lock safety");
    expect(html).toContain("Core Platform");
    expect(html).toContain("Create task in To Do");
  });

  it("respects ?view=list searchParam while defaulting invalid/empty params to Board view", async () => {
    vi.mocked(requireTeamMember).mockResolvedValue({
      user: mockUser,
      team: mockTeam,
      membership: {
        teamId: TEAM_ID,
        userId: mockUser.id,
        role: "OWNER",
        joinedAt: new Date(),
      },
      role: "OWNER",
    });
    vi.mocked(getTeamTasksPageResult).mockResolvedValue({
      tasks: [],
      totalCount: 0,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    vi.mocked(getTaskFormOptions).mockResolvedValue({
      projects: [{ id: PROJECT_ID, name: "Core Platform", status: "ACTIVE" }],
      members: [],
    });

    const listJsx = await TeamTasksPage({
      params: Promise.resolve({ teamId: TEAM_ID }),
      searchParams: Promise.resolve({ view: "list", q: "auth", page: "2" }),
    });
    const listHtml = renderToString(listJsx as React.ReactElement);
    expect(getTeamTasksPageResult).toHaveBeenCalledWith(
      TEAM_ID,
      expect.objectContaining({ view: "list", q: "auth", page: 2 }),
    );
    expect(listHtml).toContain("No matching tasks");

    const invalidJsx = await TeamTasksPage({
      params: Promise.resolve({ teamId: TEAM_ID }),
      searchParams: Promise.resolve({ view: "unexpected" }),
    });
    const invalidHtml = renderToString(invalidJsx as React.ReactElement);
    expect(invalidHtml).toContain("Create task in To Do");
  });

  it("propagates notFound error when caller is not a team member", async () => {
    vi.mocked(requireTeamMember).mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));

    await expect(
      TeamTasksPage({ params: Promise.resolve({ teamId: TEAM_ID }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getTeamTasksPageResult).not.toHaveBeenCalled();
  });
});
