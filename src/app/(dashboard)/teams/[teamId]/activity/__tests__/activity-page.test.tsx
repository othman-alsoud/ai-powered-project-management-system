import { beforeEach, describe, expect, it, vi } from "vitest";
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
  usePathname: () => "/teams/11111111-1111-4111-8111-111111111111/activity",
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
  getTeamProjectOptions: vi.fn(),
}));

vi.mock("@/features/activity/server", () => ({
  getTeamActivity: vi.fn(),
}));

import { requireTeamMember } from "@/features/teams/server";
import { getTeamProjectOptions } from "@/features/projects/server";
import { getTeamActivity } from "@/features/activity/server";
import TeamActivityPage from "../page";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const mockUser = {
  id: USER_ID,
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
  name: "Core Engineering",
  description: null,
  ownerId: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe("TeamActivityPage (Server Component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireTeamMember).mockResolvedValue({
      user: mockUser,
      team: mockTeam,
      membership: {
        teamId: TEAM_ID,
        userId: USER_ID,
        role: "MEMBER",
        joinedAt: new Date(),
      },
      role: "MEMBER",
    });
    vi.mocked(getTeamProjectOptions).mockResolvedValue([
      {
        id: PROJECT_ID,
        name: "Core API",
      },
    ]);
    vi.mocked(getTeamActivity).mockResolvedValue({
      items: [
        {
          id: "99999999-9999-4999-8999-999999999991",
          teamId: TEAM_ID,
          action: "project_created",
          createdAt: "2026-11-25T10:00:00.000Z",
          actor: {
            id: USER_ID,
            name: "Alice Owner",
            image: null,
            isDeleted: false,
          },
          project: { id: PROJECT_ID, label: "Core API", isDeleted: false },
          task: null,
          commentId: null,
          details: { projectName: "Core API", projectStatus: "ACTIVE" },
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("verifies team membership, parses searchParams safely, and renders Team Activity timeline", async () => {
    const jsx = await TeamActivityPage({
      params: Promise.resolve({ teamId: TEAM_ID }),
      searchParams: Promise.resolve({
        action: "project_created",
        projectId: PROJECT_ID,
        limit: "10",
      }),
    });
    const html = renderToString(jsx as React.ReactElement);

    expect(requireTeamMember).toHaveBeenCalledWith(TEAM_ID);
    expect(getTeamActivity).toHaveBeenCalledWith(TEAM_ID, {
      action: "project_created",
      projectId: PROJECT_ID,
      taskId: undefined,
      limit: 10,
      cursor: undefined,
    });
    expect(html).toContain("Team Activity");
    expect(html).toContain("Core Engineering");
    expect(html).toContain('created project &quot;Core API&quot;');
  });

  it("handles malformed searchParams gracefully without throwing", async () => {
    const jsx = await TeamActivityPage({
      params: Promise.resolve({ teamId: TEAM_ID }),
      searchParams: Promise.resolve({
        action: "bogus",
        projectId: "not-a-uuid",
        limit: "-5",
        cursor: "bad-cursor",
      }),
    });
    const html = renderToString(jsx as React.ReactElement);

    expect(getTeamActivity).toHaveBeenCalledWith(TEAM_ID, {
      action: undefined,
      projectId: undefined,
      taskId: undefined,
      limit: 20,
      cursor: undefined,
    });
    expect(html).toContain("Team Activity");
  });

  it("propagates notFound when caller is not an active team member", async () => {
    vi.mocked(requireTeamMember).mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));

    await expect(
      TeamActivityPage({ params: Promise.resolve({ teamId: TEAM_ID }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getTeamActivity).not.toHaveBeenCalled();
  });
});
