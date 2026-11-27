import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock @/features/auth/server
vi.mock("@/features/auth/server", () => ({
  getActionUser: vi.fn(),
}));

// Mock @/lib/prisma
vi.mock("@/lib/prisma", () => {
  const mockTx = {
    team: {
      create: vi.fn(),
    },
    teamMember: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };

  return {
    prisma: {
      $transaction: vi.fn((callback) => callback(mockTx)),
      teamMember: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
      _mockTx: mockTx,
    },
  };
});

import { revalidatePath } from "next/cache";
import { getActionUser } from "@/features/auth/server";
import { prisma } from "@/lib/prisma";
import {
  createTeamAction,
  switchTeamAction,
  resolveActiveTeamContextAction,
  getTeamMembersAction,
} from "../actions";

const mockUser = {
  id: "user-123",
  name: "Alice Owner",
  email: "alice@example.com",
  emailVerified: true,
  image: null,
  lastActiveTeamId: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Team Server Actions", () => {
  const mockTx = (prisma as unknown as { _mockTx: {
    team: { create: ReturnType<typeof vi.fn> };
    teamMember: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    activityLog: { create: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
  } })._mockTx;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockTx.$queryRaw.mockResolvedValue([{ id: mockUser.id }]);
  });

  describe("createTeamAction", () => {
    it("returns error if user is unauthenticated", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(null);

      const result = await createTeamAction({ name: "Alpha Squad" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/Authentication required/i);
      }
    });

    it("returns validation error for invalid input", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);

      const result = await createTeamAction({ name: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.name).toBeDefined();
      }
    });

    it("atomically locks user, verifies active status, creates team, owner member, updates lastActiveTeam, and writes activity log", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      mockTx.user.findUnique.mockResolvedValueOnce(mockUser);

      const createdTeam = {
        id: "team-new-uuid",
        name: "Alpha Squad",
        description: "Primary project team",
        ownerId: "user-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockTx.team.create.mockResolvedValueOnce(createdTeam);
      mockTx.teamMember.create.mockResolvedValueOnce({
        teamId: "team-new-uuid",
        userId: "user-123",
        role: "OWNER",
        joinedAt: new Date(),
      });
      mockTx.user.update.mockResolvedValueOnce({
        ...mockUser,
        lastActiveTeamId: "team-new-uuid",
      });
      mockTx.activityLog.create.mockResolvedValueOnce({
        id: "log-1",
        teamId: "team-new-uuid",
        actorId: "user-123",
        action: "team_created",
        metadata: { teamName: "Alpha Squad" },
        createdAt: new Date(),
      });

      const result = await createTeamAction({
        name: "Alpha Squad",
        description: "Primary project team",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.teamId).toBe("team-new-uuid");
      }

      // Assert transaction step arguments
      expect(mockTx.team.create).toHaveBeenCalledWith({
        data: {
          name: "Alpha Squad",
          description: "Primary project team",
          ownerId: "user-123",
        },
      });

      expect(mockTx.teamMember.create).toHaveBeenCalledWith({
        data: {
          teamId: "team-new-uuid",
          userId: "user-123",
          role: "OWNER",
        },
      });

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { lastActiveTeamId: "team-new-uuid" },
      });

      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId: "team-new-uuid",
          actorId: "user-123",
          action: "team_created",
          metadata: {
            teamName: "Alpha Squad",
          },
        },
      });

      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
      const lockSql = (mockTx.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
      expect(lockSql).toContain('FROM "user"');
      expect(lockSql).toContain("FOR NO KEY UPDATE");
      expect(lockSql).not.toContain("FOR UPDATE");

      expect(revalidatePath).toHaveBeenCalledWith("/teams");
    });

    it("rejects team creation inside transaction if caller account was concurrently deleted", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      mockTx.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        deletedAt: new Date(),
      });

      const result = await createTeamAction({
        name: "Alpha Squad",
        description: "Primary project team",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("This account is no longer active.");
      }
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockTx.team.create).not.toHaveBeenCalled();
      expect(mockTx.teamMember.create).not.toHaveBeenCalled();
    });

    it("rejects team creation inside transaction if caller user row no longer exists", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      mockTx.user.findUnique.mockResolvedValueOnce(null);

      const result = await createTeamAction({ name: "Alpha Squad" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("This account is no longer active.");
      }
      expect(mockTx.team.create).not.toHaveBeenCalled();
    });
  });

  describe("switchTeamAction", () => {
    const validTeamId = "550e8400-e29b-41d4-a716-446655440001";
    const unauthorizedTeamId = "550e8400-e29b-41d4-a716-446655440002";

    it("returns error if unauthenticated", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(null);

      const result = await switchTeamAction(validTeamId);
      expect(result.success).toBe(false);
    });

    it("rejects malformed non-UUID teamId before touching database", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);

      const result = await switchTeamAction("not-a-valid-uuid");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/invalid team id/i);
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("verifies user is an active member inside transaction with user row lock before updating lastActiveTeamId", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(null);

      const result = await switchTeamAction(unauthorizedTeamId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/not an active member/i);
      }
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.$queryRaw).toHaveBeenCalled();
      expect(mockTx.user.update).not.toHaveBeenCalled();
    });

    it("rejects soft-deleted teams", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce({
        teamId: validTeamId,
        userId: "user-123",
        role: "MEMBER",
        joinedAt: new Date(),
        team: {
          id: validTeamId,
          name: "Deleted Team",
          description: null,
          ownerId: "owner-id",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: new Date(),
        },
      });

      const result = await switchTeamAction(validTeamId);
      expect(result.success).toBe(false);
      expect(mockTx.user.update).not.toHaveBeenCalled();
    });

    it("updates user.lastActiveTeamId atomically inside transaction when membership is verified", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce({
        teamId: validTeamId,
        userId: "user-123",
        role: "MEMBER",
        joinedAt: new Date(),
        team: {
          id: validTeamId,
          name: "Valid Team",
          description: null,
          ownerId: "owner-id",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      });

      const result = await switchTeamAction(validTeamId);
      expect(result.success).toBe(true);
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
      const lockSql = (mockTx.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
      expect(lockSql).toContain('FROM "user"');
      expect(lockSql).toContain("FOR NO KEY UPDATE");
      expect(lockSql).not.toContain("FOR UPDATE");
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { lastActiveTeamId: validTeamId },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/teams");
    });

    it("sanitizes unexpected database errors", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error("PrismaClientKnownRequestError: connection lost")
      );

      const result = await switchTeamAction(validTeamId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update team preference.");
      }
    });
  });

  describe("resolveActiveTeamContextAction", () => {
    const teamA = "550e8400-e29b-41d4-a716-446655440010";
    const teamB = "550e8400-e29b-41d4-a716-446655440020";

    it("returns UNAUTHENTICATED when session is invalid or user missing", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(null);

      const res = await resolveActiveTeamContextAction(teamA);
      expect(res).toEqual({ status: "UNAUTHENTICATED" });
    });

    it("returns NO_TEAMS when user has no active memberships", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce({
        ...mockUser,
        lastActiveTeamId: teamA,
      });
      vi.mocked(prisma.teamMember.findMany).mockResolvedValueOnce([]);

      const res = await resolveActiveTeamContextAction(teamA);
      expect(res).toEqual({ status: "NO_TEAMS", userId: mockUser.id });
    });

    it("returns VALID when currentTeamId matches validated lastActiveTeamId", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce({
        ...mockUser,
        lastActiveTeamId: teamB,
      });
      vi.mocked(prisma.teamMember.findMany).mockResolvedValueOnce([
        { teamId: teamA, role: "MEMBER" },
        { teamId: teamB, role: "OWNER" },
      ] as unknown as Awaited<ReturnType<typeof prisma.teamMember.findMany>>);

      const res = await resolveActiveTeamContextAction(teamB);
      expect(res).toEqual({
        status: "VALID",
        activeTeamId: teamB,
        role: "OWNER",
        userId: mockUser.id,
      });
    });

    it("returns SWITCH_REQUIRED when lastActiveTeamId points to another valid team", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce({
        ...mockUser,
        lastActiveTeamId: teamB,
      });
      vi.mocked(prisma.teamMember.findMany).mockResolvedValueOnce([
        { teamId: teamA, role: "MEMBER" },
        { teamId: teamB, role: "MANAGER" },
      ] as unknown as Awaited<ReturnType<typeof prisma.teamMember.findMany>>);

      const res = await resolveActiveTeamContextAction(teamA);
      expect(res).toEqual({
        status: "SWITCH_REQUIRED",
        activeTeamId: teamB,
        role: "MANAGER",
        userId: mockUser.id,
      });
    });

    it("never trusts stale lastActiveTeamId and falls back deterministically to earliest active membership", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce({
        ...mockUser,
        lastActiveTeamId: "550e8400-e29b-41d4-a716-446655449999",
      });
      vi.mocked(prisma.teamMember.findMany).mockResolvedValueOnce([
        { teamId: teamA, role: "MEMBER" },
        { teamId: teamB, role: "OWNER" },
      ] as unknown as Awaited<ReturnType<typeof prisma.teamMember.findMany>>);

      const res = await resolveActiveTeamContextAction("550e8400-e29b-41d4-a716-446655449999");
      expect(res).toEqual({
        status: "SWITCH_REQUIRED",
        activeTeamId: teamA,
        role: "MEMBER",
        userId: mockUser.id,
      });
    });

    it("returns ERROR on unexpected database failure without throwing", async () => {
      vi.mocked(getActionUser).mockRejectedValueOnce(new Error("DB connection timeout"));

      const res = await resolveActiveTeamContextAction(teamA);
      expect(res).toEqual({
        status: "ERROR",
        message: "Unable to verify active workspace.",
      });
    });
  });

  describe("getTeamMembersAction", () => {
    const validTeamId = "550e8400-e29b-41d4-a716-446655440010";

    it("returns error when caller is unauthenticated", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(null);

      const res = await getTeamMembersAction(validTeamId);
      expect(res).toEqual({
        success: false,
        error: "Authentication required.",
      });
      expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
      expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
    });

    it("returns safe not-found error for malformed teamId without querying members", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);

      const res = await getTeamMembersAction("not-a-uuid");
      expect(res).toEqual({
        success: false,
        error: "Team not found.",
      });
      expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
      expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
    });

    it("returns safe not-found error for non-members (anti-enumeration)", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null);

      const res = await getTeamMembersAction(validTeamId);
      expect(res).toEqual({
        success: false,
        error: "Team not found.",
      });
      expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
    });

    it("returns safe not-found error for soft-deleted teams (anti-enumeration)", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        teamId: validTeamId,
        userId: mockUser.id,
        role: "MEMBER",
        joinedAt: new Date(),
        team: {
          id: validTeamId,
          name: "Deleted Team",
          description: null,
          ownerId: "owner-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: new Date(),
        },
      } as unknown as Awaited<ReturnType<typeof prisma.teamMember.findUnique>>);

      const res = await getTeamMembersAction(validTeamId);
      expect(res).toEqual({
        success: false,
        error: "Team not found.",
      });
      expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
    });

    it("returns team members for any authorized active member (e.g., MEMBER)", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        teamId: validTeamId,
        userId: mockUser.id,
        role: "MEMBER",
        joinedAt: new Date(),
        team: {
          id: validTeamId,
          name: "Active Team",
          description: null,
          ownerId: "owner-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      } as unknown as Awaited<ReturnType<typeof prisma.teamMember.findUnique>>);

      const joinedDate = new Date("2026-01-01T00:00:00Z");
      vi.mocked(prisma.teamMember.findMany).mockResolvedValueOnce([
        {
          teamId: validTeamId,
          userId: mockUser.id,
          role: "MEMBER",
          joinedAt: joinedDate,
          user: {
            id: mockUser.id,
            name: mockUser.name,
            email: mockUser.email,
            image: null,
          },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.teamMember.findMany>>);

      const res = await getTeamMembersAction(validTeamId);
      expect(res).toEqual({
        success: true,
        data: [
          {
            userId: mockUser.id,
            name: mockUser.name,
            email: mockUser.email,
            image: null,
            role: "MEMBER",
            joinedAt: joinedDate,
          },
        ],
      });
    });
  });
});
