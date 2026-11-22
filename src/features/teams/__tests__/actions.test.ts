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
    },
    user: {
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn((callback) => callback(mockTx)),
      teamMember: {
        findUnique: vi.fn(),
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
import { createTeamAction, switchTeamAction } from "../actions";

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
    teamMember: { create: ReturnType<typeof vi.fn> };
    user: { update: ReturnType<typeof vi.fn> };
    activityLog: { create: ReturnType<typeof vi.fn> };
  } })._mockTx;

  beforeEach(() => {
    vi.restoreAllMocks();
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

    it("atomically creates team, owner member, updates lastActiveTeam, and writes activity log", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);

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

      expect(revalidatePath).toHaveBeenCalledWith("/teams");
    });
  });

  describe("switchTeamAction", () => {
    it("returns error if unauthenticated", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(null);

      const result = await switchTeamAction("team-target");
      expect(result.success).toBe(false);
    });

    it("verifies user is an active member before updating lastActiveTeamId", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null);

      const result = await switchTeamAction("team-unauthorized");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/not an active member/i);
      }
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("updates user.lastActiveTeamId when membership is verified", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        teamId: "team-valid",
        userId: "user-123",
        role: "MEMBER",
        joinedAt: new Date(),
        team: {
          id: "team-valid",
          name: "Valid Team",
          description: null,
          ownerId: "owner-id",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      } as unknown as Awaited<ReturnType<typeof prisma.teamMember.findUnique>>);

      const result = await switchTeamAction("team-valid");
      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { lastActiveTeamId: "team-valid" },
      });
    });
  });
});
