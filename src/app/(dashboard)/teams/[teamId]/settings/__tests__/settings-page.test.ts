import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/features/teams/server", () => ({
  requireTeamMember: vi.fn(),
  getTeamMembers: vi.fn(),
}));

import { requireTeamMember, getTeamMembers } from "@/features/teams/server";
import TeamSettingsPage from "../page";

describe("TeamSettingsPage (Server Component)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser = {
    id: "user-123",
    name: "Alice Owner",
    email: "alice@example.com",
    emailVerified: true,
    image: null,
    lastActiveTeamId: "team-456",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTeam = {
    id: "team-456",
    name: "Platform Engineering",
    description: "Core infra team",
    ownerId: "user-123",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockMembership = {
    teamId: "team-456",
    userId: "user-123",
    role: "OWNER" as const,
    joinedAt: new Date(),
    team: mockTeam,
  };

  const mockMembers = [
    {
      userId: "user-123",
      name: "Alice Owner",
      email: "alice@example.com",
      image: null,
      role: "OWNER" as const,
      joinedAt: new Date("2026-01-01"),
    },
    {
      userId: "user-456",
      name: "Bob Manager",
      email: "bob@example.com",
      image: null,
      role: "MANAGER" as const,
      joinedAt: new Date("2026-01-02"),
    },
  ];

  it("authenticates caller and fetches team members via server helpers", async () => {
    vi.mocked(requireTeamMember).mockResolvedValueOnce({
      user: mockUser,
      team: mockTeam,
      membership: mockMembership,
      role: "OWNER",
    });

    vi.mocked(getTeamMembers).mockResolvedValueOnce(mockMembers);

    const jsx = await TeamSettingsPage({
      params: Promise.resolve({ teamId: "team-456" }),
    });

    expect(jsx).toBeDefined();
    expect(requireTeamMember).toHaveBeenCalledWith("team-456");
    expect(getTeamMembers).toHaveBeenCalledWith("team-456");
  });

  it("propagates notFound() when caller is unauthorized", async () => {
    vi.mocked(requireTeamMember).mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));

    await expect(
      TeamSettingsPage({
        params: Promise.resolve({ teamId: "team-unauthorized" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(getTeamMembers).not.toHaveBeenCalled();
  });
});
