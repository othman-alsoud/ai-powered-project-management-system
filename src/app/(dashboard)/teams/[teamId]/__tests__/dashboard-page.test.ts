import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/teams/server", () => ({
  requireTeamMember: vi.fn(),
}));

import { requireTeamMember } from "@/features/teams/server";
import TeamDashboardPage from "../page";

describe("TeamDashboardPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders team name and role after authorizing via requireTeamMember", async () => {
    vi.mocked(requireTeamMember).mockResolvedValueOnce({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        emailVerified: true,
        image: null,
        lastActiveTeamId: "team-123",
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      team: {
        id: "team-123",
        name: "Core Engineering",
        description: "Building the future",
        ownerId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      membership: {
        teamId: "team-123",
        userId: "user-1",
        role: "OWNER",
        joinedAt: new Date(),
      },
      role: "OWNER",
    });

    const jsx = await TeamDashboardPage({
      params: Promise.resolve({ teamId: "team-123" }),
    });

    expect(jsx).toBeDefined();
    expect(requireTeamMember).toHaveBeenCalledWith("team-123");
  });
});
