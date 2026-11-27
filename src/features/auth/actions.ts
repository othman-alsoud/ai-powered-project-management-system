"use server";

import { cookies } from "next/headers";
import { verifyPassword } from "better-auth/crypto";
import { recordActivityLogs } from "@/features/activity/writer";
import { getActionUser } from "@/features/auth/server";
import { prisma } from "@/lib/prisma";
import { deleteAccountSchema } from "./validation";

export type AuthActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

function sanitizeDeleteAccountError(error: unknown): string {
  if (error instanceof Error) {
    const isDomainError =
      error.message.startsWith("Account is already deleted") ||
      error.message.startsWith("You must transfer ownership") ||
      error.message.startsWith("You have active assigned tasks");

    if (isDomainError) {
      return error.message;
    }
  }

  return "Failed to delete account. Please try again.";
}

/**
 * Permanently anonymizes the authenticated user's account inside an atomic
 * Prisma interactive transaction (BR-DEL-02, BR-TEAM-03).
 *
 * - Never physically deletes the User row; replaces PII with tombstones.
 * - Blocks deletion if the user owns any team or has active assigned tasks.
 * - Clears completed/soft-deleted task assignments, removes TeamMember records,
 *   deletes recipient notifications, sessions, accounts, and verification tokens.
 * - Records anonymous `member_departed` ActivityLog entries for non-owned teams.
 */
export async function deleteAccountAction(
  input: unknown
): Promise<AuthActionResult<{ userId: string }>> {
  const user = await getActionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = deleteAccountSchema.safeParse(input);
  if (!parseResult.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parseResult.error.issues) {
      const field = issue.path[0] as string;
      if (field) {
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(issue.message);
      }
    }
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors,
    };
  }

  const { password } = parseResult.data;

  try {
    // Re-authenticate credential accounts before acquiring transaction row locks
    const credentialAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
        password: { not: null },
      },
      select: { password: true },
    });

    if (credentialAccount?.password) {
      if (!password || password.length === 0) {
        return {
          success: false,
          error: "Current password is required to delete your account.",
          fieldErrors: { password: ["Current password is required."] },
        };
      }

      const isPasswordValid = await verifyPassword({
        hash: credentialAccount.password,
        password,
      });

      if (!isPasswordValid) {
        return {
          success: false,
          error: "Incorrect password. Please try again.",
          fieldErrors: { password: ["Incorrect password."] },
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Lock user row to serialize against concurrent addMember, removeMember,
      //    transferOwnership, switchTeam, and duplicate deleteAccount requests
      await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${user.id} FOR UPDATE`;

      // 2. Re-read user inside transaction and reject if already anonymized
      const lockedUser = await tx.user.findUnique({
        where: { id: user.id },
      });

      if (!lockedUser || lockedUser.deletedAt !== null) {
        throw new Error("Account is already deleted or unavailable.");
      }

      // 3. Enforce BR-TEAM-03 across all team records (active or soft-deleted)
      const ownedTeam = await tx.team.findFirst({
        where: { ownerId: user.id },
        select: { id: true, name: true },
      });

      if (ownedTeam) {
        throw new Error(
          "You must transfer ownership of all owned teams before deleting your account."
        );
      }

      // 4. Reject if any active assigned tasks exist (deletedAt: null, status !== DONE)
      const activeAssignedTask = await tx.task.findFirst({
        where: {
          assignedToId: user.id,
          deletedAt: null,
          status: { not: "DONE" },
        },
        select: { id: true },
      });

      if (activeAssignedTask) {
        throw new Error(
          "You have active assigned tasks. Reassign or complete them before deleting your account."
        );
      }

      // 5. Clear completed (DONE) and soft-deleted task assignments so TeamMember
      //    deletion satisfies ON DELETE RESTRICT without deleting task history
      await tx.task.updateMany({
        where: {
          assignedToId: user.id,
          OR: [{ status: "DONE" }, { deletedAt: { not: null } }],
        },
        data: { assignedToId: null },
      });

      // 6. Record anonymous member_departed ActivityLog entries (zero PII)
      const leavingMemberships = await tx.teamMember.findMany({
        where: { userId: user.id },
        select: { teamId: true, role: true },
      });

      await recordActivityLogs(
        tx,
        leavingMemberships.map((m) => ({
          teamId: m.teamId,
          actorId: user.id,
          action: "member_departed" as const,
          metadata: {
            reason: "account_deleted" as const,
            previousRole: m.role,
          },
        })),
      );

      // 7. Delete memberships, personal inbox notifications, sessions, accounts, and tokens
      await tx.teamMember.deleteMany({
        where: { userId: user.id },
      });

      await tx.notification.deleteMany({
        where: { userId: user.id },
      });

      await tx.session.deleteMany({
        where: { userId: user.id },
      });

      await tx.account.deleteMany({
        where: { userId: user.id },
      });

      await tx.verification.deleteMany({
        where: { identifier: lockedUser.email },
      });

      // 8. Anonymize User record in-place while preserving UUID for audit integrity
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: "Deleted User",
          email: `deleted_${user.id}@deleted.local`,
          image: null,
          emailVerified: false,
          lastActiveTeamId: null,
          deletedAt: new Date(),
        },
      });
    });

    // Clear Better Auth session cookies safely after transaction commit
    try {
      const cookieStore = await cookies();
      cookieStore.delete("better-auth.session_token");
      cookieStore.delete("__Secure-better-auth.session_token");
    } catch {
      // Safe no-op in non-request contexts
    }

    return {
      success: true,
      data: { userId: user.id },
    };
  } catch (error) {
    console.error("[deleteAccountAction] Failed to anonymize account:", error);

    return {
      success: false,
      error: sanitizeDeleteAccountError(error),
    };
  }
}
