import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server", () => ({
  getActionUser: vi.fn(),
}));

type MockTx = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  teamMember: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  project: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  task: { findMany: ReturnType<typeof vi.fn> };
  activityLog: { create: ReturnType<typeof vi.fn> };
  notification: { createMany: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/prisma", () => {
  const mockTx: MockTx = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    teamMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: { findMany: vi.fn() },
    activityLog: { create: vi.fn() },
    notification: { createMany: vi.fn() },
    $queryRaw: vi.fn(),
  };

  return {
    prisma: {
      $transaction: vi.fn((callback) => callback(mockTx)),
      _mockTx: mockTx,
    },
  };
});

import { revalidatePath } from "next/cache";
import { getActionUser } from "@/features/auth/server";
import { prisma } from "@/lib/prisma";
import {
  createProjectAction,
  updateProjectAction,
  updateProjectStatusAction,
  deleteProjectAction,
} from "../actions";

const teamId = "550e8400-e29b-41d4-a716-446655440001";
const otherTeamId = "550e8400-e29b-41d4-a716-446655440099";
const projectId = "550e8400-e29b-41d4-a716-446655440002";
const userId = "550e8400-e29b-41d4-a716-446655440003";

const activeUser = {
  id: userId,
  name: "Alice Manager",
  email: "alice@example.com",
  emailVerified: true,
  image: null,
  lastActiveTeamId: teamId,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const activeTeam = {
  id: teamId,
  name: "Platform Team",
  description: null,
  ownerId: userId,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const ownerMembership = {
  teamId,
  userId,
  role: "OWNER" as const,
  joinedAt: new Date(),
  team: activeTeam,
};

const managerMembership = {
  ...ownerMembership,
  role: "MANAGER" as const,
};

const memberMembership = {
  ...ownerMembership,
  role: "MEMBER" as const,
};

const existingProject = {
  id: projectId,
  teamId,
  name: "Alpha Project",
  description: "Initial description",
  status: "PLANNING" as const,
  startDate: new Date("2026-12-01T00:00:00.000Z"),
  endDate: new Date("2026-12-10T00:00:00.000Z"),
  createdById: userId,
  updatedById: null,
  createdAt: new Date("2026-11-20T00:00:00.000Z"),
  updatedAt: new Date("2026-11-20T00:00:00.000Z"),
  deletedAt: null,
};

describe("Project Server Actions", () => {
  const mockTx = (prisma as unknown as { _mockTx: MockTx })._mockTx;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.$queryRaw.mockResolvedValue([{ id: teamId }]);
    mockTx.user.findMany.mockResolvedValue([]);
    mockTx.task.findMany.mockResolvedValue([]);
    mockTx.teamMember.findMany.mockResolvedValue([]);
    mockTx.notification.createMany.mockResolvedValue({ count: 0 });
  });

  describe("createProjectAction", () => {
    it("rejects unauthenticated callers", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(null);
      const res = await createProjectAction({ teamId, name: "Project X" });
      expect(res).toEqual({ success: false, error: "Authentication required." });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects MEMBER role inside locked transaction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(memberMembership);

      const res = await createProjectAction({ teamId, name: "Project X" });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/forbidden|owners and managers/i);
      }
      expect(mockTx.project.create).not.toHaveBeenCalled();
    });

    it("rejects concurrently deleted acting user after acquiring user lock", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce({ ...activeUser, deletedAt: new Date() });

      const res = await createProjectAction({ teamId, name: "Project X" });
      expect(res).toEqual({ success: false, error: "This account is no longer active." });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(mockTx.project.create).not.toHaveBeenCalled();
    });

    it("locks team then user with FOR NO KEY UPDATE, creates project, allows duplicate names & same-day dates, and writes ActivityLog", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(managerMembership);
      mockTx.project.create.mockResolvedValueOnce({
        ...existingProject,
        name: "Alpha Project",
        status: "ACTIVE",
        startDate: new Date("2026-12-01T00:00:00.000Z"),
        endDate: new Date("2026-12-01T00:00:00.000Z"),
      });
      mockTx.activityLog.create.mockResolvedValueOnce({ id: "log-1" });

      const res = await createProjectAction({
        teamId,
        name: "Alpha Project",
        description: "",
        status: "ACTIVE",
        startDate: "2026-12-01",
        endDate: "2026-12-01",
      });

      expect(res).toEqual({
        success: true,
        data: {
          projectId,
          name: "Alpha Project",
          status: "ACTIVE",
        },
      });

      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      const teamLockSql = (mockTx.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
      const userLockSql = (mockTx.$queryRaw.mock.calls[1]?.[0] as TemplateStringsArray).join("?");
      expect(teamLockSql).toContain('FROM "team"');
      expect(teamLockSql).toContain("FOR NO KEY UPDATE");
      expect(teamLockSql).not.toContain("FOR UPDATE");
      expect(userLockSql).toContain('FROM "user"');
      expect(userLockSql).toContain("FOR NO KEY UPDATE");
      expect(userLockSql).not.toContain("FOR UPDATE");

      expect(mockTx.project.create).toHaveBeenCalledWith({
        data: {
          teamId,
          name: "Alpha Project",
          description: null,
          status: "ACTIVE",
          startDate: new Date("2026-12-01T00:00:00.000Z"),
          endDate: new Date("2026-12-01T00:00:00.000Z"),
          createdById: userId,
        },
      });

      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId,
          actorId: userId,
          projectId,
          action: "project_created",
          metadata: {
            projectName: "Alpha Project",
            status: "ACTIVE",
            startDate: "2026-12-01",
            endDate: "2026-12-01",
          },
        },
      });
      expect(revalidatePath).toHaveBeenCalledWith(`/teams/${teamId}/projects`);
    });

    it("rejects soft-deleted team inside locked transaction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce({
        ...ownerMembership,
        team: { ...activeTeam, deletedAt: new Date() },
      });

      const res = await createProjectAction({ teamId, name: "Project X" });
      expect(res).toEqual({
        success: false,
        error: "Forbidden: Not an active member of this team.",
      });
      expect(mockTx.project.create).not.toHaveBeenCalled();
    });

    it("sanitizes unexpected database errors on create", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error('PrismaClientKnownRequestError: constraint "project_teamId_fkey"')
      );

      const res = await createProjectAction({ teamId, name: "Project X" });
      expect(res).toEqual({
        success: false,
        error: "Failed to create project. Please try again.",
      });
    });
  });

  describe("updateProjectAction", () => {
    it("locks team -> project (with id AND teamId) -> user using FOR NO KEY UPDATE", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce(existingProject);
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        name: "Alpha v2",
        status: "ACTIVE",
      });
      mockTx.activityLog.create.mockResolvedValueOnce({ id: "log-2" });

      const res = await updateProjectAction({
        teamId,
        projectId,
        name: "Alpha v2",
        description: "Initial description",
        status: "ACTIVE",
        startDate: "2026-12-01",
        endDate: "2026-12-10",
      });

      expect(res.success).toBe(true);
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
      const lock1 = (mockTx.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
      const lock2 = (mockTx.$queryRaw.mock.calls[1]?.[0] as TemplateStringsArray).join("?");
      const lock3 = (mockTx.$queryRaw.mock.calls[2]?.[0] as TemplateStringsArray).join("?");
      expect(lock1).toContain('FROM "team"');
      expect(lock1).toContain("FOR NO KEY UPDATE");
      expect(lock2).toContain('FROM "project"');
      expect(lock2).toContain('AND "teamId" =');
      expect(lock2).toContain("FOR NO KEY UPDATE");
      expect(lock2).not.toContain("FOR UPDATE");
      expect(lock3).toContain('FROM "user"');
      expect(lock3).toContain("FOR NO KEY UPDATE");

      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId,
          actorId: userId,
          projectId,
          action: "project_updated",
          metadata: {
            projectName: "Alpha v2",
            changedFields: ["name", "status"],
            previousStatus: "PLANNING",
            newStatus: "ACTIVE",
          },
        },
      });
    });

    it("rejects partial update when new endDate precedes existing stored startDate", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(managerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce(existingProject);

      const res = await updateProjectAction({
        teamId,
        projectId,
        name: existingProject.name,
        endDate: "2026-11-25",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.fieldErrors?.endDate?.[0]).toMatch(/earlier than start date/i);
      }
      expect(mockTx.project.update).not.toHaveBeenCalled();
      expect(mockTx.activityLog.create).not.toHaveBeenCalled();
    });

    it("skips project.update and ActivityLog on no-op updates", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce(existingProject);

      const res = await updateProjectAction({
        teamId,
        projectId,
        name: "  Alpha Project  ",
        description: "Initial description",
        status: "PLANNING",
        startDate: "2026-12-01",
        endDate: "2026-12-10",
      });

      expect(res.success).toBe(true);
      expect(mockTx.project.update).not.toHaveBeenCalled();
      expect(mockTx.activityLog.create).not.toHaveBeenCalled();
    });

    it("rejects cross-team or soft-deleted projects safely", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce({
        ...ownerMembership,
        teamId: otherTeamId,
        team: { ...activeTeam, id: otherTeamId },
      });
      mockTx.project.findUnique.mockResolvedValueOnce(null);

      const res = await updateProjectAction({
        teamId: otherTeamId,
        projectId,
        name: "Hijack",
      });

      expect(res).toEqual({ success: false, error: "Project not found." });
      expect(mockTx.project.update).not.toHaveBeenCalled();
    });

    it("name-only update omits previousStatus and newStatus from ActivityLog metadata", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce(existingProject);
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        name: "Renamed Alpha",
      });
      mockTx.activityLog.create.mockResolvedValueOnce({ id: "log-name" });

      const res = await updateProjectAction({
        teamId,
        projectId,
        name: "Renamed Alpha",
      });

      expect(res.success).toBe(true);
      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId,
          actorId: userId,
          projectId,
          action: "project_updated",
          metadata: {
            projectName: "Renamed Alpha",
            changedFields: ["name"],
          },
        },
      });
    });

    it("description-only update omits previousStatus and newStatus from ActivityLog metadata", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(managerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce(existingProject);
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        description: "Updated scope details",
      });
      mockTx.activityLog.create.mockResolvedValueOnce({ id: "log-desc" });

      const res = await updateProjectAction({
        teamId,
        projectId,
        name: existingProject.name,
        description: "Updated scope details",
      });

      expect(res.success).toBe(true);
      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId,
          actorId: userId,
          projectId,
          action: "project_updated",
          metadata: {
            projectName: existingProject.name,
            changedFields: ["description"],
          },
        },
      });
    });

    it("rejects MEMBER role on updateProjectAction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(memberMembership);

      const res = await updateProjectAction({
        teamId,
        projectId,
        name: "Unauthorized Update",
      });

      expect(res).toEqual({
        success: false,
        error: "Forbidden: Only team owners and managers can manage projects.",
      });
      expect(mockTx.project.update).not.toHaveBeenCalled();
    });

    it("rejects updating a soft-deleted project", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce({
        ...existingProject,
        deletedAt: new Date("2026-11-23T00:00:00.000Z"),
      });

      const res = await updateProjectAction({
        teamId,
        projectId,
        name: "Resurrect Attempt",
      });

      expect(res).toEqual({ success: false, error: "Project not found." });
      expect(mockTx.project.update).not.toHaveBeenCalled();
    });

    it("rejects concurrently deleted user after acquiring lock on updateProjectAction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce({
        ...activeUser,
        deletedAt: new Date(),
      });

      const res = await updateProjectAction({
        teamId,
        projectId,
        name: "Deleted User Update",
      });

      expect(res).toEqual({ success: false, error: "This account is no longer active." });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
      expect(mockTx.project.update).not.toHaveBeenCalled();
    });

    it("sanitizes unexpected database errors on updateProjectAction", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error('PostgreSQL error: deadlock detected in "project"')
      );

      const res = await updateProjectAction({
        teamId,
        projectId,
        name: "Any Name",
      });

      expect(res).toEqual({
        success: false,
        error: "Failed to update project. Please try again.",
      });
    });
  });

  describe("updateProjectStatusAction", () => {
    it("allows transitioning from COMPLETED back to ACTIVE and logs previousStatus/newStatus", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(managerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce({
        ...existingProject,
        status: "COMPLETED",
      });
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        status: "ACTIVE",
      });
      mockTx.activityLog.create.mockResolvedValueOnce({ id: "log-3" });

      const res = await updateProjectStatusAction({
        teamId,
        projectId,
        status: "ACTIVE",
      });

      expect(res).toEqual({
        success: true,
        data: { projectId, status: "ACTIVE" },
      });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
      const lock1 = (mockTx.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
      const lock2 = (mockTx.$queryRaw.mock.calls[1]?.[0] as TemplateStringsArray).join("?");
      const lock3 = (mockTx.$queryRaw.mock.calls[2]?.[0] as TemplateStringsArray).join("?");
      expect(lock1).toContain('FROM "team"');
      expect(lock1).toContain("FOR NO KEY UPDATE");
      expect(lock2).toContain('FROM "project"');
      expect(lock2).toContain('AND "teamId" =');
      expect(lock2).toContain("FOR NO KEY UPDATE");
      expect(lock3).toContain('FROM "user"');
      expect(lock3).toContain("FOR NO KEY UPDATE");
      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId,
          actorId: userId,
          projectId,
          action: "project_updated",
          metadata: {
            projectName: existingProject.name,
            changedFields: ["status"],
            previousStatus: "COMPLETED",
            newStatus: "ACTIVE",
          },
        },
      });
    });

    it("does not write ActivityLog when status is unchanged (no-op)", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce(existingProject);

      const res = await updateProjectStatusAction({
        teamId,
        projectId,
        status: "PLANNING",
      });

      expect(res.success).toBe(true);
      expect(mockTx.project.update).not.toHaveBeenCalled();
      expect(mockTx.activityLog.create).not.toHaveBeenCalled();
    });
  });

  describe("deleteProjectAction", () => {
    it("soft-deletes project via deletedAt (never hard delete) and logs project_deleted", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce(existingProject);
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        deletedAt: new Date(),
      });
      mockTx.activityLog.create.mockResolvedValueOnce({ id: "log-4" });

      const res = await deleteProjectAction({ teamId, projectId });

      expect(res).toEqual({
        success: true,
        data: { projectId },
      });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
      const lock1 = (mockTx.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
      const lock2 = (mockTx.$queryRaw.mock.calls[1]?.[0] as TemplateStringsArray).join("?");
      const lock3 = (mockTx.$queryRaw.mock.calls[2]?.[0] as TemplateStringsArray).join("?");
      expect(lock1).toContain('FROM "team"');
      expect(lock1).toContain("FOR NO KEY UPDATE");
      expect(lock2).toContain('FROM "project"');
      expect(lock2).toContain('AND "teamId" =');
      expect(lock2).toContain("FOR NO KEY UPDATE");
      expect(lock3).toContain('FROM "user"');
      expect(lock3).toContain("FOR NO KEY UPDATE");
      expect(mockTx.project.delete).not.toHaveBeenCalled();
      expect(mockTx.project.update).toHaveBeenCalledWith({
        where: { id_teamId: { id: projectId, teamId } },
        data: {
          deletedAt: expect.any(Date),
          updatedById: userId,
        },
      });
      expect(mockTx.activityLog.create).toHaveBeenCalledWith({
        data: {
          teamId,
          actorId: userId,
          projectId,
          action: "project_deleted",
          metadata: {
            projectName: existingProject.name,
            previousStatus: "PLANNING",
          },
        },
      });
      expect(revalidatePath).toHaveBeenCalledWith(`/teams/${teamId}/projects`);
      expect(revalidatePath).toHaveBeenCalledWith(`/teams/${teamId}/projects/${projectId}`);
    });

    it("rejects MEMBER role and sanitizes unexpected DB errors", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(memberMembership);

      const forbiddenRes = await deleteProjectAction({ teamId, projectId });
      expect(forbiddenRes.success).toBe(false);
      if (!forbiddenRes.success) {
        expect(forbiddenRes.error).toMatch(/forbidden/i);
      }

      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error('PrismaClientKnownRequestError: constraint "chk_project_dates" violated')
      );
      const dbErrRes = await deleteProjectAction({ teamId, projectId });
      expect(dbErrRes).toEqual({
        success: false,
        error: "Failed to delete project. Please try again.",
      });
    });
  });

  describe("M3.3 notification dispatch", () => {
    const recipientOneId = "550e8400-e29b-41d4-a716-446655440010";
    const recipientTwoId = "550e8400-e29b-41d4-a716-446655440011";
    const removedMemberId = "550e8400-e29b-41d4-a716-446655440012";
    const deletedUserId = "550e8400-e29b-41d4-a716-446655440013";

    it("updateProjectStatusAction locks candidate users via FOR KEY SHARE in deterministic ascending order, revalidates deletedAt & membership, deduplicates, and notifies inside tx on COMPLETED", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(managerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce({
        ...existingProject,
        status: "ACTIVE",
        createdById: recipientTwoId,
      });
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        status: "COMPLETED",
        createdById: recipientTwoId,
      });
      mockTx.activityLog.create.mockResolvedValueOnce({ id: "log-comp" });
      mockTx.task.findMany.mockResolvedValueOnce([
        { assignedToId: deletedUserId },
        { assignedToId: userId },
        { assignedToId: recipientTwoId },
        { assignedToId: removedMemberId },
        { assignedToId: recipientOneId },
        { assignedToId: recipientOneId },
      ]);
      mockTx.user.findMany.mockResolvedValueOnce([
        { id: recipientOneId },
        { id: recipientTwoId },
        { id: removedMemberId },
      ]);
      mockTx.teamMember.findMany.mockResolvedValueOnce([
        { userId: recipientOneId },
        { userId: recipientTwoId },
      ]);

      const res = await updateProjectStatusAction({
        teamId,
        projectId,
        status: "COMPLETED",
      });

      expect(res).toEqual({
        success: true,
        data: { projectId, status: "COMPLETED" },
      });
      expect(mockTx.task.findMany).toHaveBeenCalledWith({
        where: {
          teamId,
          projectId,
          deletedAt: null,
          assignedToId: { not: null },
        },
        select: { assignedToId: true },
        distinct: ["assignedToId"],
      });

      // Lock calls: 3 initial locks (team, project, caller) + 4 recipient FOR KEY SHARE locks in ascending order
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(7);
      const recipientLockCalls = mockTx.$queryRaw.mock.calls.slice(3).map((call) => ({
        sql: (call[0] as TemplateStringsArray).join("?").replace(/\s+/g, " ").trim(),
        values: call.slice(1),
      }));
      expect(recipientLockCalls).toEqual([
        {
          sql: 'SELECT id FROM "user" WHERE id = ?::uuid FOR KEY SHARE',
          values: [recipientOneId],
        },
        {
          sql: 'SELECT id FROM "user" WHERE id = ?::uuid FOR KEY SHARE',
          values: [recipientTwoId],
        },
        {
          sql: 'SELECT id FROM "user" WHERE id = ?::uuid FOR KEY SHARE',
          values: [removedMemberId],
        },
        {
          sql: 'SELECT id FROM "user" WHERE id = ?::uuid FOR KEY SHARE',
          values: [deletedUserId],
        },
      ]);

      expect(mockTx.user.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [recipientOneId, recipientTwoId, removedMemberId, deletedUserId],
          },
          deletedAt: null,
        },
        select: { id: true },
      });
      expect(mockTx.teamMember.findMany).toHaveBeenCalledWith({
        where: {
          teamId,
          userId: { in: [recipientOneId, recipientTwoId, removedMemberId] },
          user: { deletedAt: null },
        },
        select: { userId: true },
      });
      expect(mockTx.notification.createMany).toHaveBeenCalledTimes(1);
      expect(mockTx.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: recipientOneId,
            actorId: userId,
            teamId,
            projectId,
            taskId: null,
            type: "project_completed",
            title: "Project completed",
            message: 'Project "Alpha Project" was marked as Completed.',
          },
          {
            userId: recipientTwoId,
            actorId: userId,
            teamId,
            projectId,
            taskId: null,
            type: "project_completed",
            title: "Project completed",
            message: 'Project "Alpha Project" was marked as Completed.',
          },
        ],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("updateProjectStatusAction skips teamMember lookup & notification insert when all locked candidates were concurrently deleted", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce({
        ...existingProject,
        status: "ACTIVE",
      });
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        status: "COMPLETED",
      });
      mockTx.task.findMany.mockResolvedValueOnce([{ assignedToId: deletedUserId }]);
      mockTx.user.findMany.mockResolvedValueOnce([]);

      const res = await updateProjectStatusAction({
        teamId,
        projectId,
        status: "COMPLETED",
      });

      expect(res.success).toBe(true);
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(4);
      expect(mockTx.user.findMany).toHaveBeenCalledTimes(1);
      expect(mockTx.teamMember.findMany).not.toHaveBeenCalled();
      expect(mockTx.notification.createMany).not.toHaveBeenCalled();
    });

    it("updateProjectStatusAction notifies on CANCELLED and re-transitions, but skips non-terminal, no-op, or creator with no assigned task", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce({
        ...existingProject,
        status: "COMPLETED",
        createdById: recipientTwoId,
      });
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        status: "CANCELLED",
        createdById: recipientTwoId,
      });
      mockTx.task.findMany.mockResolvedValueOnce([
        { assignedToId: recipientOneId },
      ]);
      mockTx.user.findMany.mockResolvedValueOnce([{ id: recipientOneId }]);
      mockTx.teamMember.findMany.mockResolvedValueOnce([
        { userId: recipientOneId },
      ]);

      const cancelRes = await updateProjectStatusAction({
        teamId,
        projectId,
        status: "CANCELLED",
      });
      expect(cancelRes.success).toBe(true);
      expect(mockTx.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: recipientOneId,
            actorId: userId,
            teamId,
            projectId,
            taskId: null,
            type: "project_cancelled",
            title: "Project cancelled",
            message: 'Project "Alpha Project" was marked as Cancelled.',
          },
        ],
      });

      vi.clearAllMocks();
      mockTx.$queryRaw.mockResolvedValue([{ id: teamId }]);
      mockTx.user.findMany.mockResolvedValue([]);
      mockTx.task.findMany.mockResolvedValue([]);
      mockTx.teamMember.findMany.mockResolvedValue([]);
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce({
        ...existingProject,
        status: "CANCELLED",
      });
      await updateProjectStatusAction({
        teamId,
        projectId,
        status: "CANCELLED",
      });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
      expect(mockTx.notification.createMany).not.toHaveBeenCalled();

      vi.clearAllMocks();
      mockTx.$queryRaw.mockResolvedValue([{ id: teamId }]);
      mockTx.user.findMany.mockResolvedValue([]);
      mockTx.task.findMany.mockResolvedValue([]);
      mockTx.teamMember.findMany.mockResolvedValue([]);
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce({
        ...existingProject,
        status: "ACTIVE",
      });
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        status: "ON_HOLD",
      });
      await updateProjectStatusAction({
        teamId,
        projectId,
        status: "ON_HOLD",
      });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
      expect(mockTx.notification.createMany).not.toHaveBeenCalled();
    });

    it("updateProjectAction notifies on transition to COMPLETED/CANCELLED after FOR KEY SHARE lock & revalidation, and skips name-only edits on already COMPLETED project", async () => {
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce({
        ...existingProject,
        status: "ACTIVE",
      });
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        name: "Alpha Final",
        status: "COMPLETED",
      });
      mockTx.task.findMany.mockResolvedValueOnce([{ assignedToId: recipientOneId }]);
      mockTx.user.findMany.mockResolvedValueOnce([{ id: recipientOneId }]);
      mockTx.teamMember.findMany.mockResolvedValueOnce([{ userId: recipientOneId }]);

      const res = await updateProjectAction({
        teamId,
        projectId,
        name: "Alpha Final",
        status: "COMPLETED",
      });
      expect(res.success).toBe(true);
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(4);
      expect(mockTx.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: recipientOneId,
            type: "project_completed",
            message: 'Project "Alpha Final" was marked as Completed.',
          }),
        ],
      });

      vi.clearAllMocks();
      mockTx.$queryRaw.mockResolvedValue([{ id: teamId }]);
      mockTx.user.findMany.mockResolvedValue([]);
      mockTx.task.findMany.mockResolvedValue([]);
      mockTx.teamMember.findMany.mockResolvedValue([]);
      vi.mocked(getActionUser).mockResolvedValueOnce(activeUser);
      mockTx.user.findUnique.mockResolvedValueOnce(activeUser);
      mockTx.teamMember.findUnique.mockResolvedValueOnce(ownerMembership);
      mockTx.project.findUnique.mockResolvedValueOnce({
        ...existingProject,
        status: "COMPLETED",
      });
      mockTx.project.update.mockResolvedValueOnce({
        ...existingProject,
        name: "Alpha Renamed",
        status: "COMPLETED",
      });
      await updateProjectAction({
        teamId,
        projectId,
        name: "Alpha Renamed",
        status: "COMPLETED",
      });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
      expect(mockTx.notification.createMany).not.toHaveBeenCalled();
    });
  });
});
