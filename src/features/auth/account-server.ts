import { prisma } from "@/lib/prisma";

export type OwnedTeamBlocker = {
  id: string;
  name: string;
  deletedAt: Date | null;
  memberCount: number;
};

export type AccountDeletionEligibility = {
  eligible: boolean;
  ownedTeams: OwnedTeamBlocker[];
  activeAssignedTaskCount: number;
  hasPasswordAccount: boolean;
  authProviders: string[];
};

function formatProviderLabel(providerId: string): string {
  switch (providerId) {
    case "credential":
      return "Email & Password";
    case "google":
      return "Google OAuth";
    default:
      return providerId.charAt(0).toUpperCase() + providerId.slice(1);
  }
}

/**
 * Inspects pre-flight account deletion eligibility for UI presentation.
 * Checks ALL owned teams (active or soft-deleted, per BR-TEAM-03 & DB invariant)
 * and active assigned tasks (deletedAt: null, status !== "DONE").
 *
 * NOTE: Pre-flight eligibility is for UI presentation only. deleteAccountAction
 * re-verifies all invariants inside a locked database transaction.
 */
export async function getAccountDeletionEligibility(
  userId: string
): Promise<AccountDeletionEligibility> {
  const [ownedTeamRows, activeAssignedTaskCount, accountRows] = await Promise.all([
    prisma.team.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        deletedAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.count({
      where: {
        assignedToId: userId,
        deletedAt: null,
        status: { not: "DONE" },
      },
    }),
    prisma.account.findMany({
      where: { userId },
      select: {
        providerId: true,
        password: true,
      },
    }),
  ]);

  const ownedTeams: OwnedTeamBlocker[] = ownedTeamRows.map((t) => ({
    id: t.id,
    name: t.name,
    deletedAt: t.deletedAt,
    memberCount: t._count.members,
  }));

  const hasPasswordAccount = accountRows.some(
    (a) => a.providerId === "credential" && a.password !== null
  );

  const authProviders = Array.from(
    new Set(accountRows.map((a) => formatProviderLabel(a.providerId)))
  );

  return {
    eligible: ownedTeams.length === 0 && activeAssignedTaskCount === 0,
    ownedTeams,
    activeAssignedTaskCount,
    hasPasswordAccount,
    authProviders,
  };
}
