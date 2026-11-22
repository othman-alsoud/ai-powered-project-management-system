import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT: ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

// Mock @/features/auth/server
vi.mock("@/features/auth/server", () => ({
  getAuthenticatedUser: vi.fn(),
}));

// Mock @/lib/prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    teamMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
  },
}));

import { redirect, notFound } from "next/navigation";
import { getAuthenticatedUser } from "@/features/auth/server";
import { prisma } from "@/lib/prisma";
import { getTeamById, getUserTeams, requireTeamMember } from "../server";

const mockUser = {
  id: "user-123",
  name: "Alice Engineer",
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
  name: "Acme Platform",
  description: "Primary engineering team",
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

describe("Team Server Helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getTeamById", () => {
    it("returns team and membership when user is an active member", async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(
        mockMembership as unknown as Awaited<ReturnType<typeof prisma.teamMember.findUnique>>
      );

      const result = await getTeamById("team-456", "user-123");
      expect(result).not.toBeNull();
      expect(result?.team.id).toBe("team-456");
      expect(result?.membership.role).toBe("OWNER");
      expect(prisma.teamMember.findUnique).toHaveBeenCalledWith({
        where: {
          teamId_userId: {
            teamId: "team-456",
            userId: "user-123",
          },
        },
        include: {
          team: true,
        },
      });
    });

    it("returns null if user is not a member of the team", async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null);

      const result = await getTeamById("team-other", "user-123");
      expect(result).toBeNull();
    });

    it("returns null if team is soft-deleted", async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        ...mockMembership,
        team: {
          ...mockTeam,
          deletedAt: new Date(),
        },
      } as unknown as Awaited<ReturnType<typeof prisma.teamMember.findUnique>>);

      const result = await getTeamById("team-456", "user-123");
      expect(result).toBeNull();
    });
  });

  describe("getUserTeams", () => {
    it("returns all active teams for user with role", async () => {
      vi.mocked(prisma.teamMember.findMany).mockResolvedValueOnce([
        mockMembership,
        {
          teamId: "team-789",
          userId: "user-123",
          role: "MEMBER" as const,
          joinedAt: new Date(),
          team: {
            id: "team-789",
            name: "Design Guild",
            description: null,
            ownerId: "user-other",
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.teamMember.findMany>>);

      const teams = await getUserTeams("user-123");
      expect(teams).toHaveLength(2);
      expect(teams[0]?.name).toBe("Acme Platform");
      expect(teams[0]?.role).toBe("OWNER");
      expect(teams[1]?.name).toBe("Design Guild");
      expect(teams[1]?.role).toBe("MEMBER");
    });
  });

  describe("requireTeamMember", () => {
    it("redirects to /sign-in when user has no active session", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        success: false,
        status: "NO_SESSION",
        user: null,
        reason: "NO_SESSION",
      });

      await expect(requireTeamMember("team-456")).rejects.toThrow(
        "NEXT_REDIRECT: /sign-in"
      );
      expect(redirect).toHaveBeenCalledWith("/sign-in");
    });

    it("triggers notFound() when user is not a member of the team (404 anti-probing)", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        success: true,
        status: "AUTHENTICATED",
        user: mockUser,
        reason: null,
      });

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null);

      await expect(requireTeamMember("team-unauthorized")).rejects.toThrow(
        "NEXT_NOT_FOUND"
      );
      expect(notFound).toHaveBeenCalled();
    });

    it("returns user, team, membership, and role when access is authorized", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        success: true,
        status: "AUTHENTICATED",
        user: mockUser,
        reason: null,
      });

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(
        mockMembership as unknown as Awaited<ReturnType<typeof prisma.teamMember.findUnique>>
      );

      const context = await requireTeamMember("team-456");
      expect(context.team.id).toBe("team-456");
      expect(context.role).toBe("OWNER");
      expect(context.user.id).toBe("user-123");
    });
  });
});
