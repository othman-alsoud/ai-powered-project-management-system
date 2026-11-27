import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => `/teams/${teamId}/projects/${projectId}`,
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

vi.mock("@/features/teams/server", () => ({
  requireTeamMember: vi.fn(),
}));

vi.mock("@/features/projects/server", () => ({
  getTeamProjects: vi.fn(),
  getProjectById: vi.fn(),
}));

vi.mock("@/features/tasks/server", () => ({
  getProjectTasks: vi.fn(async () => []),
  getTeamTasksPageResult: vi.fn(async () => ({
    tasks: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  })),
  getTaskFormOptions: vi.fn(async () => ({
    projects: [],
    members: [],
  })),
}));

vi.mock("@/features/activity/server", () => ({
  getProjectActivity: vi.fn(async () => ({
    items: [],
    nextCursor: null,
    hasMore: false,
  })),
}));

import { requireTeamMember } from "@/features/teams/server";
import { getTeamProjects, getProjectById } from "@/features/projects/server";
import { getProjectActivity } from "@/features/activity/server";
import ProjectsPage from "../page";
import ProjectDetailPage from "../[projectId]/page";

const teamId = "550e8400-e29b-41d4-a716-446655440001";
const projectId = "550e8400-e29b-41d4-a716-446655440010";

const mockUser = {
  id: "user-1",
  name: "Alice Owner",
  email: "alice@example.com",
  emailVerified: true,
  image: null,
  lastActiveTeamId: teamId,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTeam = {
  id: teamId,
  name: "Platform Team",
  description: null,
  ownerId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockProject = {
  id: projectId,
  teamId,
  name: "Milestone 2.1 Rollout",
  description: "Full project CRUD delivery",
  status: "ACTIVE" as const,
  startDate: new Date("2026-11-24T00:00:00.000Z"),
  endDate: new Date("2026-12-01T00:00:00.000Z"),
  createdAt: new Date("2026-11-20T00:00:00.000Z"),
  updatedAt: new Date("2026-11-22T00:00:00.000Z"),
  taskCount: 2,
  createdBy: { id: "user-1", name: "Deleted User", image: null },
  updatedBy: { id: "user-2", name: "Bob Manager", image: null },
};

describe("Project Pages (Server Components)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ProjectsPage", () => {
    it("verifies membership via requireTeamMember and renders team projects", async () => {
      vi.mocked(requireTeamMember).mockResolvedValueOnce({
        user: mockUser,
        team: mockTeam,
        membership: {
          teamId,
          userId: mockUser.id,
          role: "OWNER",
          joinedAt: new Date(),
        },
        role: "OWNER",
      });
      vi.mocked(getTeamProjects).mockResolvedValueOnce([mockProject]);

      const jsx = await ProjectsPage({ params: Promise.resolve({ teamId }) });
      const html = renderToString(jsx as React.ReactElement);

      expect(requireTeamMember).toHaveBeenCalledWith(teamId);
      expect(getTeamProjects).toHaveBeenCalledWith(teamId, {
        sort: "createdAt",
        dir: "desc",
      });
      expect(html).toContain("Projects");
      expect(html).toContain("Milestone 2.1 Rollout");
    });

    it("passes validated project sort searchParams to getTeamProjects", async () => {
      vi.mocked(requireTeamMember).mockResolvedValueOnce({
        user: mockUser,
        team: mockTeam,
        membership: {
          teamId,
          userId: mockUser.id,
          role: "MEMBER",
          joinedAt: new Date(),
        },
        role: "MEMBER",
      });
      vi.mocked(getTeamProjects).mockResolvedValueOnce([mockProject]);

      const jsx = await ProjectsPage({
        params: Promise.resolve({ teamId }),
        searchParams: Promise.resolve({ sort: "name", dir: "asc" }),
      });
      const html = renderToString(jsx as React.ReactElement);

      expect(getTeamProjects).toHaveBeenCalledWith(teamId, {
        sort: "name",
        dir: "asc",
      });
      expect(html).toContain('aria-label="Sort projects by"');
    });

    it("propagates notFound when caller is not an active team member", async () => {
      vi.mocked(requireTeamMember).mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));

      await expect(
        ProjectsPage({ params: Promise.resolve({ teamId }) })
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(getTeamProjects).not.toHaveBeenCalled();
    });
  });

  describe("ProjectDetailPage", () => {
    it("verifies membership, queries project by [projectId, teamId], and renders detail metadata", async () => {
      vi.mocked(requireTeamMember).mockResolvedValueOnce({
        user: mockUser,
        team: mockTeam,
        membership: {
          teamId,
          userId: mockUser.id,
          role: "MEMBER",
          joinedAt: new Date(),
        },
        role: "MEMBER",
      });
      vi.mocked(getProjectById).mockResolvedValueOnce(mockProject);

      const jsx = await ProjectDetailPage({
        params: Promise.resolve({ teamId, projectId }),
      });
      const html = renderToString(jsx as React.ReactElement);

      expect(requireTeamMember).toHaveBeenCalledWith(teamId);
      expect(getProjectById).toHaveBeenCalledWith(projectId, teamId);
      expect(html).toContain("Milestone 2.1 Rollout");
      expect(html).toContain("Full project CRUD delivery");
      expect(html).toContain("Nov 24, 2026");
      expect(html).toContain("Dec 1, 2026");
      expect(html).toContain("Deleted User");
      expect(html).toContain("Bob Manager");
      expect(html).not.toContain("Change project status");
    });

    it("calls notFound() when project does not exist, is soft-deleted, or belongs to another team", async () => {
      vi.mocked(requireTeamMember).mockResolvedValueOnce({
        user: mockUser,
        team: mockTeam,
        membership: {
          teamId,
          userId: mockUser.id,
          role: "OWNER",
          joinedAt: new Date(),
        },
        role: "OWNER",
      });
      vi.mocked(getProjectById).mockResolvedValueOnce(null);

      await expect(
        ProjectDetailPage({
          params: Promise.resolve({ teamId, projectId }),
        })
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mockNotFound).toHaveBeenCalled();
    });

    it("renders project-scoped tasks in Board view by default and honors ?view=list", async () => {
      vi.mocked(requireTeamMember).mockResolvedValue({
        user: mockUser,
        team: mockTeam,
        membership: {
          teamId,
          userId: mockUser.id,
          role: "OWNER",
          joinedAt: new Date(),
        },
        role: "OWNER",
      });
      vi.mocked(getProjectById).mockResolvedValue(mockProject);

      const boardJsx = await ProjectDetailPage({
        params: Promise.resolve({ teamId, projectId }),
      });
      const boardHtml = renderToString(boardJsx as React.ReactElement);
      expect(boardHtml).toContain('aria-label="Task view mode"');
      expect(boardHtml).toContain('role="tablist"');

      const listJsx = await ProjectDetailPage({
        params: Promise.resolve({ teamId, projectId }),
        searchParams: Promise.resolve({ view: "list" }),
      });
      const listHtml = renderToString(listJsx as React.ReactElement);
      expect(listHtml).toContain("No tasks yet");
    });

    it("renders project-scoped Activity tab via getProjectActivity when ?tab=activity", async () => {
      vi.mocked(requireTeamMember).mockResolvedValueOnce({
        user: mockUser,
        team: mockTeam,
        membership: {
          teamId,
          userId: mockUser.id,
          role: "MEMBER",
          joinedAt: new Date(),
        },
        role: "MEMBER",
      });
      vi.mocked(getProjectById).mockResolvedValueOnce(mockProject);
      vi.mocked(getProjectActivity).mockResolvedValueOnce({
        items: [
          {
            id: "99999999-9999-4999-8999-999999999991",
            teamId,
            action: "task_created",
            createdAt: "2026-11-25T10:00:00.000Z",
            actor: {
              id: "user-1",
              name: "Alice Owner",
              image: null,
              isDeleted: false,
            },
            project: {
              id: projectId,
              label: "Milestone 2.1 Rollout",
              isDeleted: false,
            },
            task: {
              id: "44444444-4444-4444-8444-444444444444",
              label: "Verify timeline",
              isDeleted: false,
            },
            commentId: null,
            details: { taskTitle: "Verify timeline" },
          },
        ],
        nextCursor: null,
        hasMore: false,
      });

      const activityJsx = await ProjectDetailPage({
        params: Promise.resolve({ teamId, projectId }),
        searchParams: Promise.resolve({ tab: "activity", action: "task_created" }),
      });
      const activityHtml = renderToString(activityJsx as React.ReactElement);

      expect(getProjectActivity).toHaveBeenCalledWith(
        teamId,
        projectId,
        expect.objectContaining({ action: "task_created" }),
      );
      expect(activityHtml).toContain('aria-label="Project sections"');
      expect(activityHtml).toContain("Project activity timeline");
      expect(activityHtml).toContain('created task &quot;Verify timeline&quot;');
    });
  });
});
