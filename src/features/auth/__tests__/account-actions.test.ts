import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCookieDelete } = vi.hoisted(() => ({
  mockCookieDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    delete: mockCookieDelete,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server", () => ({
  getActionUser: vi.fn(),
}));

vi.mock("better-auth/crypto", () => ({
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const mockTx = {
    $queryRaw: vi.fn(),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    team: {
      findFirst: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    teamMember: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    activityLog: {
      createMany: vi.fn(),
    },
    notification: {
      deleteMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    account: {
      deleteMany: vi.fn(),
    },
    verification: {
      deleteMany: vi.fn(),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn((callback) => callback(mockTx)),
      account: {
        findFirst: vi.fn(),
      },
      _mockTx: mockTx,
    },
  };
});

import { verifyPassword } from "better-auth/crypto";
import { getActionUser } from "@/features/auth/server";
import { prisma } from "@/lib/prisma";
import { deleteAccountAction } from "../actions";

type MockTx = {
  $queryRaw: ReturnType<typeof vi.fn>;
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  team: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  task: {
    findFirst: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  teamMember: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  activityLog: {
    createMany: ReturnType<typeof vi.fn>;
  };
  notification: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  session: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  account: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  verification: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

const mockUserId = "550e8400-e29b-41d4-a716-446655440000";
const mockTeam1 = "550e8400-e29b-41d4-a716-446655440010";
const mockTeam2 = "550e8400-e29b-41d4-a716-446655440020";

const mockActiveUser = {
  id: mockUserId,
  name: "Alice Contributor",
  email: "alice@example.com",
  emailVerified: true,
  image: "https://example.com/alice.png",
  lastActiveTeamId: mockTeam1,
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("deleteAccountAction", () => {
  const mockTx = (prisma as unknown as { _mockTx: MockTx })._mockTx;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.$queryRaw.mockResolvedValue([{ id: mockUserId }]);
  });

  function setupEligibleTransaction(memberships: Array<{ teamId: string; role: string }> = []) {
    mockTx.user.findUnique.mockResolvedValueOnce(mockActiveUser);
    mockTx.team.findFirst.mockResolvedValueOnce(null);
    mockTx.task.findFirst.mockResolvedValueOnce(null);
    mockTx.task.updateMany.mockResolvedValueOnce({ count: 0 });
    mockTx.teamMember.findMany.mockResolvedValueOnce(memberships);
    mockTx.activityLog.createMany.mockResolvedValueOnce({ count: memberships.length });
    mockTx.teamMember.deleteMany.mockResolvedValueOnce({ count: memberships.length });
    mockTx.notification.deleteMany.mockResolvedValueOnce({ count: 2 });
    mockTx.session.deleteMany.mockResolvedValueOnce({ count: 1 });
    mockTx.account.deleteMany.mockResolvedValueOnce({ count: 1 });
    mockTx.verification.deleteMany.mockResolvedValueOnce({ count: 0 });
    mockTx.user.update.mockResolvedValueOnce({
      ...mockActiveUser,
      name: "Deleted User",
      email: `deleted_${mockUserId}@deleted.local`,
      image: null,
      emailVerified: false,
      lastActiveTeamId: null,
      deletedAt: new Date(),
    });
  }

  it("rejects unauthenticated users without touching database", async () => {
    vi.mocked(getActionUser).mockResolvedValueOnce(null);

    const res = await deleteAccountAction({ confirmationPhrase: "DELETE" });
    expect(res).toEqual({
      success: false,
      error: "Authentication required.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid confirmation phrase", async () => {
    vi.mocked(getActionUser).mockResolvedValueOnce(mockActiveUser);

    const res = await deleteAccountAction({ confirmationPhrase: "delete" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.fieldErrors?.confirmationPhrase).toBeDefined();
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires password for credential accounts and rejects missing password", async () => {
    vi.mocked(getActionUser).mockResolvedValueOnce(mockActiveUser);
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce({
      password: "stored-scrypt-hash",
    } as unknown as Awaited<ReturnType<typeof prisma.account.findFirst>>);

    const res = await deleteAccountAction({ confirmationPhrase: "DELETE" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/password is required/i);
      expect(res.fieldErrors?.password).toBeDefined();
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects incorrect password for credential accounts", async () => {
    vi.mocked(getActionUser).mockResolvedValueOnce(mockActiveUser);
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce({
      password: "stored-scrypt-hash",
    } as unknown as Awaited<ReturnType<typeof prisma.account.findFirst>>);
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    const res = await deleteAccountAction({
      confirmationPhrase: "DELETE",
      password: "wrong-password",
    });

    expect(verifyPassword).toHaveBeenCalledWith({
      hash: "stored-scrypt-hash",
      password: "wrong-password",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/incorrect password/i);
      expect(res.fieldErrors?.password).toBeDefined();
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows OAuth-only account without password and executes full anonymization transaction", async () => {
    vi.mocked(getActionUser).mockResolvedValueOnce(mockActiveUser);
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce(null);
    setupEligibleTransaction([
      { teamId: mockTeam1, role: "MEMBER" },
      { teamId: mockTeam2, role: "MANAGER" },
    ]);

    const res = await deleteAccountAction({ confirmationPhrase: "DELETE" });

    expect(res).toEqual({
      success: true,
      data: { userId: mockUserId },
    });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);

    // Re-read inside transaction
    expect(mockTx.user.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
    });

    // Clear completed and soft-deleted task assignments before deleting memberships
    expect(mockTx.task.updateMany).toHaveBeenCalledWith({
      where: {
        assignedToId: mockUserId,
        OR: [{ status: "DONE" }, { deletedAt: { not: null } }],
      },
      data: { assignedToId: null },
    });

    // Record anonymous member_departed entries without PII
    expect(mockTx.activityLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          teamId: mockTeam1,
          actorId: mockUserId,
          action: "member_departed",
          metadata: { reason: "account_deleted", previousRole: "MEMBER" },
        },
        {
          teamId: mockTeam2,
          actorId: mockUserId,
          action: "member_departed",
          metadata: { reason: "account_deleted", previousRole: "MANAGER" },
        },
      ],
    });

    // Delete memberships, recipient notifications, sessions, accounts, and verifications
    expect(mockTx.teamMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: mockUserId },
    });
    expect(mockTx.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: mockUserId },
    });
    expect(mockTx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: mockUserId },
    });
    expect(mockTx.account.deleteMany).toHaveBeenCalledWith({
      where: { userId: mockUserId },
    });
    expect(mockTx.verification.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "alice@example.com" },
    });

    // Anonymize user row in-place
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: {
        name: "Deleted User",
        email: `deleted_${mockUserId}@deleted.local`,
        image: null,
        emailVerified: false,
        lastActiveTeamId: null,
        deletedAt: expect.any(Date),
      },
    });

    // Clear Better Auth cookies after commit
    expect(mockCookieDelete).toHaveBeenCalledWith("better-auth.session_token");
    expect(mockCookieDelete).toHaveBeenCalledWith("__Secure-better-auth.session_token");
  });

  it("verifies password and succeeds for credential account", async () => {
    vi.mocked(getActionUser).mockResolvedValueOnce(mockActiveUser);
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce({
      password: "stored-scrypt-hash",
    } as unknown as Awaited<ReturnType<typeof prisma.account.findFirst>>);
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);
    setupEligibleTransaction([]);

    const res = await deleteAccountAction({
      confirmationPhrase: "DELETE",
      password: "valid-password",
    });

    expect(res.success).toBe(true);
    expect(verifyPassword).toHaveBeenCalledWith({
      hash: "stored-scrypt-hash",
      password: "valid-password",
    });
    expect(mockTx.activityLog.createMany).not.toHaveBeenCalled();
  });

  it("rejects already-deleted user re-read inside transaction (idempotency guard)", async () => {
    vi.mocked(getActionUser).mockResolvedValueOnce(mockActiveUser);
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce(null);
    mockTx.user.findUnique.mockResolvedValueOnce({
      ...mockActiveUser,
      deletedAt: new Date(),
    });

    const res = await deleteAccountAction({ confirmationPhrase: "DELETE" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/already deleted/i);
    }
    expect(mockTx.user.update).not.toHaveBeenCalled();
  });

  it("blocks deletion inside transaction if user owns any team (BR-TEAM-03)", async () => {
    vi.mocked(getActionUser).mockResolvedValueOnce(mockActiveUser);
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce(null);
    mockTx.user.findUnique.mockResolvedValueOnce(mockActiveUser);
    mockTx.team.findFirst.mockResolvedValueOnce({
      id: mockTeam1,
      name: "Owned Team",
    });

    const res = await deleteAccountAction({ confirmationPhrase: "DELETE" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/transfer ownership/i);
    }
    expect(mockTx.teamMember.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.user.update).not.toHaveBeenCalled();
  });

  it("blocks deletion inside transaction if user has active assigned tasks (deletedAt: null, status !== DONE)", async () => {
    vi.mocked(getActionUser).mockResolvedValueOnce(mockActiveUser);
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce(null);
    mockTx.user.findUnique.mockResolvedValueOnce(mockActiveUser);
    mockTx.team.findFirst.mockResolvedValueOnce(null);
    mockTx.task.findFirst.mockResolvedValueOnce({ id: "task-active-1" });

    const res = await deleteAccountAction({ confirmationPhrase: "DELETE" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/active assigned tasks/i);
    }
    expect(mockTx.task.updateMany).not.toHaveBeenCalled();
    expect(mockTx.teamMember.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.user.update).not.toHaveBeenCalled();
  });

  it("sanitizes unexpected database failures without leaking Prisma or SQL internals", async () => {
    vi.mocked(getActionUser).mockResolvedValueOnce(mockActiveUser);
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(
      new Error('PrismaClientKnownRequestError: constraint "task_teamId_assignedToId_fkey" failed')
    );

    const res = await deleteAccountAction({ confirmationPhrase: "DELETE" });
    expect(res).toEqual({
      success: false,
      error: "Failed to delete account. Please try again.",
    });
    expect(mockCookieDelete).not.toHaveBeenCalled();
  });
});
