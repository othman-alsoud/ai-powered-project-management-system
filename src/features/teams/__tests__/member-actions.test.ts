import { describe, it, expect, vi, beforeEach } from "vitest";

type MockTx = {
  team: { update: ReturnType<typeof vi.fn> };
  teamMember: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  task: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  activityLog: {
    create: ReturnType<typeof vi.fn>;
  };
  $queryRaw: ReturnType<typeof vi.fn>;
};

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
      update: vi.fn(),
    },
    teamMember: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
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
      },
      user: {
        findUnique: vi.fn(),
      },
      _mockTx: mockTx,
    },
  };
});

import { revalidatePath } from "next/cache";
import { getActionUser } from "@/features/auth/server";
import { prisma } from "@/lib/prisma";
import {
  addMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
  transferOwnershipAction,
} from "../actions";

const mockUserId = "550e8400-e29b-41d4-a716-446655440000";
const mockTeamId = "550e8400-e29b-41d4-a716-446655440001";
const mockOtherUserId = "550e8400-e29b-41d4-a716-446655440002";

const mockOwnerUser = {
  id: mockUserId,
  name: "Alice Owner",
  email: "alice@example.com",
  emailVerified: true,
  image: null,
  lastActiveTeamId: mockTeamId,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockManagerUser = {
  id: mockOtherUserId,
  name: "Bob Manager",
  email: "bob@example.com",
  emailVerified: true,
  image: null,
  lastActiveTeamId: mockTeamId,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTeam = {
  id: mockTeamId,
  name: "Test Team",
  description: null,
  ownerId: mockUserId,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockOwnerMembership = {
  teamId: mockTeamId,
  userId: mockUserId,
  role: "OWNER" as const,
  joinedAt: new Date(),
  team: mockTeam,
};

const mockManagerMembership = {
  teamId: mockTeamId,
  userId: mockOtherUserId,
  role: "MANAGER" as const,
  joinedAt: new Date(),
  team: mockTeam,
};

const mockMemberMembership = {
  teamId: mockTeamId,
  userId: mockOtherUserId,
  role: "MEMBER" as const,
  joinedAt: new Date(),
  team: mockTeam,
};

describe("Team Member Management Actions", () => {
  const mockTx = (prisma as unknown as { _mockTx: MockTx })._mockTx;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(mockTx.$queryRaw).mockResolvedValue([{ id: mockTeamId }]);
  });

  describe("addMemberAction", () => {
    it("returns error if user is unauthenticated", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(null);
      const result = await addMemberAction({ teamId: mockTeamId, email: "new@example.com", role: "MEMBER" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/Authentication required/i);
    });

    it("rejects non-OWNER roles (MEMBER)", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockMemberMembership);
      const result = await addMemberAction({ teamId: mockTeamId, email: "new@example.com", role: "MEMBER" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/forbidden|owner/i);
    });

    it("rejects unknown email", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(null);
      const result = await addMemberAction({ teamId: mockTeamId, email: "unknown@example.com", role: "MEMBER" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/not found/i);
    });

    it("rejects soft-deleted user", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce({ ...mockManagerUser, deletedAt: new Date() });
      const result = await addMemberAction({ teamId: mockTeamId, email: "bob@example.com", role: "MEMBER" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/no longer active|deactivat/i);
    });

    it("acquires target user row lock and rejects if user was anonymized concurrently after email lookup", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce({ ...mockManagerUser, deletedAt: new Date() });

      const result = await addMemberAction({ teamId: mockTeamId, email: "bob@example.com", role: "MEMBER" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/no longer active|deactivat/i);
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(mockTx.teamMember.create).not.toHaveBeenCalled();
    });

    it("successfully adds a new member as MEMBER", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.create).mockResolvedValueOnce({ teamId: mockTeamId, userId: mockOtherUserId, role: "MEMBER", joinedAt: new Date() });
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({ id: "log-1" });
      const result = await addMemberAction({ teamId: mockTeamId, email: "bob@example.com", role: "MEMBER" });
      expect(result.success).toBe(true);
      expect(mockTx.teamMember.create).toHaveBeenCalledWith({ data: { teamId: mockTeamId, userId: mockOtherUserId, role: "MEMBER" } });
      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId: mockTeamId,
          actorId: mockUserId,
          action: "member_added",
          metadata: {
            addedUserId: mockOtherUserId,
            role: "MEMBER",
          },
        },
      });
      const loggedPayload = JSON.stringify(mockTx.activityLog.create.mock.calls[0]);
      expect(loggedPayload).not.toContain("addedUserEmail");
      expect(loggedPayload).not.toContain("bob@example.com");
      expect(revalidatePath).toHaveBeenCalledWith(`/teams/${mockTeamId}/settings`);
    });

    it("trims whitespace from email before lookup", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.create).mockResolvedValueOnce({});
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      await addMemberAction({ teamId: mockTeamId, email: "  BOB@Example.COM  ", role: "MEMBER" });
      expect(mockTx.user.findUnique).toHaveBeenCalledWith({ where: { email: "BOB@Example.COM" } });
    });

    it("uses a Prisma interactive transaction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.create).mockResolvedValueOnce({});
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      await addMemberAction({ teamId: mockTeamId, email: "bob@example.com", role: "MEMBER" });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("acquires team and target user row locks using FOR NO KEY UPDATE inside transaction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.create).mockResolvedValueOnce({});
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      await addMemberAction({ teamId: mockTeamId, email: "bob@example.com", role: "MEMBER" });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      const teamLockSql = (mockTx.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
      const userLockSql = (mockTx.$queryRaw.mock.calls[1]?.[0] as TemplateStringsArray).join("?");
      expect(teamLockSql).toContain('FROM "team"');
      expect(teamLockSql).toContain("FOR NO KEY UPDATE");
      expect(teamLockSql).not.toContain("FOR UPDATE");
      expect(userLockSql).toContain('FROM "user"');
      expect(userLockSql).toContain("FOR NO KEY UPDATE");
      expect(userLockSql).not.toContain("FOR UPDATE");
    });

    it("re-checks OWNER authorization after acquiring lock", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      // First call inside transaction returns non-OWNER membership (re-check fails)
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockMemberMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.create).mockResolvedValueOnce({});
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      const result = await addMemberAction({ teamId: mockTeamId, email: "bob@example.com", role: "MEMBER" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/forbidden|owner/i);
    });

    it("performs all mutations through tx client, not global prisma", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.create).mockResolvedValueOnce({});
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      await addMemberAction({ teamId: mockTeamId, email: "bob@example.com", role: "MEMBER" });
      expect(mockTx.teamMember.create).toHaveBeenCalled();
      expect(mockTx.activityLog.create).toHaveBeenCalled();
    });
  });

  describe("updateMemberRoleAction", () => {
    it("returns error if user is unauthenticated", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(null);
      const result = await updateMemberRoleAction({ teamId: mockTeamId, userId: mockOtherUserId, role: "MEMBER" });
      expect(result.success).toBe(false);
    });

    it("rejects non-OWNER roles", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      const result = await updateMemberRoleAction({ teamId: mockTeamId, userId: mockOtherUserId, role: "MEMBER" });
      expect(result.success).toBe(false);
    });

    it("rejects changing OWNER's role", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      const result = await updateMemberRoleAction({ teamId: mockTeamId, userId: mockUserId, role: "MEMBER" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/owner|role/i);
    });

    it("rejects OWNER changing their own role", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      const result = await updateMemberRoleAction({ teamId: mockTeamId, userId: mockUserId, role: "MANAGER" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/own role|self/i);
    });

    it("successfully updates a member's role", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.update).mockResolvedValueOnce({ teamId: mockTeamId, userId: mockOtherUserId, role: "MEMBER" });
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({ id: "log-1" });
      const result = await updateMemberRoleAction({ teamId: mockTeamId, userId: mockOtherUserId, role: "MEMBER" });
      expect(result.success).toBe(true);
      expect(mockTx.teamMember.update).toHaveBeenCalledWith({ where: { teamId_userId: { teamId: mockTeamId, userId: mockOtherUserId } }, data: { role: "MEMBER" } });
      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: { teamId: mockTeamId, actorId: mockUserId, action: "member_role_updated", metadata: expect.anything() },
      });
    });

    it("skips teamMember.update and ActivityLog when role is unchanged (no-op)", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);

      const result = await updateMemberRoleAction({
        teamId: mockTeamId,
        userId: mockOtherUserId,
        role: "MANAGER",
      });

      expect(result).toEqual({
        success: true,
        data: { teamId: mockTeamId, userId: mockOtherUserId, role: "MANAGER" },
      });
      expect(mockTx.teamMember.update).not.toHaveBeenCalled();
      expect(mockTx.activityLog.create).not.toHaveBeenCalled();
    });

    it("uses a Prisma interactive transaction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.update).mockResolvedValueOnce({});
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      await updateMemberRoleAction({ teamId: mockTeamId, userId: mockOtherUserId, role: "MEMBER" });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("acquires team row lock using FOR NO KEY UPDATE inside transaction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.update).mockResolvedValueOnce({});
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      await updateMemberRoleAction({ teamId: mockTeamId, userId: mockOtherUserId, role: "MEMBER" });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
      const teamLockSql = (mockTx.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
      expect(teamLockSql).toContain('FROM "team"');
      expect(teamLockSql).toContain("FOR NO KEY UPDATE");
      expect(teamLockSql).not.toContain("FOR UPDATE");
    });
  });

  describe("removeMemberAction", () => {
    it("returns error if user is unauthenticated", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(null);
      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(result.success).toBe(false);
    });

    it("rejects non-OWNER roles", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(result.success).toBe(false);
    });

    it("rejects OWNER removing themselves", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockUserId });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/themselves|self/i);
    });

    it("rejects removing the current OWNER", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockUserId });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/owner|yourself|self/i);
    });

    it("rejects removing a member with assigned tasks", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.task.findFirst).mockResolvedValueOnce({ id: "task-1" });
      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/assigned tasks/i);
      expect(mockTx.teamMember.delete).not.toHaveBeenCalled();
    });

    it("returns safe membership error if membership disappears concurrently after acquiring user lock", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.task.findFirst).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(null);

      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("User is not a member of this team.");
      }
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(mockTx.teamMember.delete).not.toHaveBeenCalled();
      expect(mockTx.activityLog.create).not.toHaveBeenCalled();
    });

    it("successfully removes a member with no assigned tasks", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.task.findFirst).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.delete).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({ id: "log-1" });
      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(result.success).toBe(true);
      expect(mockTx.teamMember.delete).toHaveBeenCalledWith({ where: { teamId_userId: { teamId: mockTeamId, userId: mockOtherUserId } } });
      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: { teamId: mockTeamId, actorId: mockUserId, action: "member_removed", metadata: expect.anything() },
      });
    });

    it("uses a Prisma interactive transaction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.task.findFirst).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.delete).mockResolvedValueOnce({});
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("acquires team and target user row locks using FOR NO KEY UPDATE inside transaction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.task.findFirst).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.delete).mockResolvedValueOnce({});
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce({ lastActiveTeamId: null });
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      const teamLockSql = (mockTx.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
      const userLockSql = (mockTx.$queryRaw.mock.calls[1]?.[0] as TemplateStringsArray).join("?");
      expect(teamLockSql).toContain('FROM "team"');
      expect(teamLockSql).toContain("FOR NO KEY UPDATE");
      expect(teamLockSql).not.toContain("FOR UPDATE");
      expect(userLockSql).toContain('FROM "user"');
      expect(userLockSql).toContain("FOR NO KEY UPDATE");
      expect(userLockSql).not.toContain("FOR UPDATE");
    });

    it("acquires target user row lock and resets lastActiveTeamId to deterministic fallback when removed from current active team (BR-CTX-02)", async () => {
      const fallbackTeamId = "550e8400-e29b-41d4-a716-446655440099";
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.task.findFirst).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.delete).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce({ lastActiveTeamId: mockTeamId });
      vi.mocked(mockTx.teamMember.findFirst).mockResolvedValueOnce({ teamId: fallbackTeamId });
      vi.mocked(mockTx.user.update).mockResolvedValueOnce({});
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({ id: "log-1" });

      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(result.success).toBe(true);
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(mockTx.teamMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockOtherUserId,
          team: { deletedAt: null },
        },
        orderBy: [{ joinedAt: "asc" }, { teamId: "asc" }],
        select: { teamId: true },
      });
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: mockOtherUserId },
        data: { lastActiveTeamId: fallbackTeamId },
      });
    });

    it("resets lastActiveTeamId to null when removed from active team and no other active teams remain (BR-CTX-02)", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.task.findFirst).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.delete).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce({ lastActiveTeamId: mockTeamId });
      vi.mocked(mockTx.teamMember.findFirst).mockResolvedValueOnce(null);
      vi.mocked(mockTx.user.update).mockResolvedValueOnce({});
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({ id: "log-1" });

      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(result.success).toBe(true);
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: mockOtherUserId },
        data: { lastActiveTeamId: null },
      });
    });

    it("leaves lastActiveTeamId untouched if target user's active team is a different team", async () => {
      const otherTeamId = "550e8400-e29b-41d4-a716-446655440088";
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.task.findFirst).mockResolvedValueOnce(null);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.delete).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce({ lastActiveTeamId: otherTeamId });
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({ id: "log-1" });

      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(result.success).toBe(true);
      expect(mockTx.user.update).not.toHaveBeenCalled();
    });
  });

  describe("transferOwnershipAction", () => {
    it("returns error if user is unauthenticated", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(null);
      const result = await transferOwnershipAction({ teamId: mockTeamId, newOwnerUserId: mockOtherUserId });
      expect(result.success).toBe(false);
    });

    it("rejects non-OWNER roles", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      const result = await transferOwnershipAction({ teamId: mockTeamId, newOwnerUserId: mockOtherUserId });
      expect(result.success).toBe(false);
    });

    it("rejects self-transfer", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      const result = await transferOwnershipAction({ teamId: mockTeamId, newOwnerUserId: mockUserId });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/self/i);
    });

    it("rejects transferring to a non-member", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(null);
      const result = await transferOwnershipAction({ teamId: mockTeamId, newOwnerUserId: mockOtherUserId });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/member/i);
    });

    it("acquires recipient user row lock and rejects transferring ownership to an anonymized/deleted account", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce({ ...mockManagerUser, deletedAt: new Date() });

      const result = await transferOwnershipAction({ teamId: mockTeamId, newOwnerUserId: mockOtherUserId });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toMatch(/deactivated|no longer active/i);
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(mockTx.teamMember.update).not.toHaveBeenCalled();
    });

    it("successfully transfers ownership", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.update).mockResolvedValueOnce({});
      vi.mocked(mockTx.team.update).mockResolvedValueOnce(mockTeam);
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({ id: "log-1" });
      const result = await transferOwnershipAction({ teamId: mockTeamId, newOwnerUserId: mockOtherUserId });
      expect(result.success).toBe(true);
      expect(mockTx.teamMember.update).toHaveBeenCalledTimes(2);
      expect(mockTx.teamMember.update).toHaveBeenNthCalledWith(1, { where: { teamId_userId: { teamId: mockTeamId, userId: mockUserId } }, data: { role: "MANAGER" } });
      expect(mockTx.teamMember.update).toHaveBeenNthCalledWith(2, { where: { teamId_userId: { teamId: mockTeamId, userId: mockOtherUserId } }, data: { role: "OWNER" } });
      expect(mockTx.team.update).toHaveBeenCalledWith({ where: { id: mockTeamId }, data: { ownerId: mockOtherUserId } });
      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: { teamId: mockTeamId, actorId: mockUserId, action: "ownership_transferred", metadata: expect.anything() },
      });
    });

    it("uses a Prisma interactive transaction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.update).mockResolvedValueOnce({});
      vi.mocked(mockTx.team.update).mockResolvedValueOnce(mockTeam);
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      await transferOwnershipAction({ teamId: mockTeamId, newOwnerUserId: mockOtherUserId });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("acquires team and recipient user row locks using FOR NO KEY UPDATE inside transaction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockOwnerMembership);
      vi.mocked(mockTx.user.findUnique).mockResolvedValueOnce(mockManagerUser);
      vi.mocked(mockTx.teamMember.findUnique).mockResolvedValueOnce(mockManagerMembership);
      vi.mocked(mockTx.teamMember.update).mockResolvedValueOnce({});
      vi.mocked(mockTx.team.update).mockResolvedValueOnce(mockTeam);
      vi.mocked(mockTx.activityLog.create).mockResolvedValueOnce({});
      await transferOwnershipAction({ teamId: mockTeamId, newOwnerUserId: mockOtherUserId });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      const teamLockSql = (mockTx.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
      const userLockSql = (mockTx.$queryRaw.mock.calls[1]?.[0] as TemplateStringsArray).join("?");
      expect(teamLockSql).toContain('FROM "team"');
      expect(teamLockSql).toContain("FOR NO KEY UPDATE");
      expect(teamLockSql).not.toContain("FOR UPDATE");
      expect(userLockSql).toContain('FROM "user"');
      expect(userLockSql).toContain("FOR NO KEY UPDATE");
      expect(userLockSql).not.toContain("FOR UPDATE");
    });

    it("sanitizes unexpected database errors without leaking internal details", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error("PrismaClientKnownRequestError: relation 'team_member' table lock failed")
      );

      const result = await transferOwnershipAction({ teamId: mockTeamId, newOwnerUserId: mockOtherUserId });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to transfer ownership. Please try again.");
        expect(result.error).not.toContain("PrismaClient");
        expect(result.error).not.toContain("team_member");
      }
    });
  });

  describe("Error Sanitization across actions", () => {
    it("sanitizes database error on addMemberAction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error("pg_catalog.pg_database error: connection terminated unexpectedly")
      );

      const result = await addMemberAction({ teamId: mockTeamId, email: "user@example.com", role: "MEMBER" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to add member. Please try again.");
      }
    });

    it("sanitizes database error on updateMemberRoleAction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error("internal database error")
      );

      const result = await updateMemberRoleAction({ teamId: mockTeamId, userId: mockOtherUserId, role: "MEMBER" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to update member role. Please try again.");
      }
    });

    it("sanitizes database error on removeMemberAction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(mockOwnerUser);
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error("foreign key constraint error")
      );

      const result = await removeMemberAction({ teamId: mockTeamId, userId: mockOtherUserId });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to remove member. Please try again.");
      }
    });
  });
});