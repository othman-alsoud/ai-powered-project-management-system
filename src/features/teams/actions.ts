"use server";

import { revalidatePath } from "next/cache";
import { recordActivityLog } from "@/features/activity/writer";
import { getActionUser } from "@/features/auth/server";
import { prisma } from "@/lib/prisma";
import {
  createTeamSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
  transferOwnershipSchema,
  switchTeamSchema,
} from "./validation";
import { getTeamMembers, type TeamRole } from "./server";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Sanitizes action errors to ensure internal Prisma, PostgreSQL,
 * or database driver details are never leaked to client callers.
 */
function sanitizeActionError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    const isDomainError =
      error.message.startsWith("Forbidden:") ||
      error.message.startsWith("User with this email") ||
      error.message.startsWith("This account is no longer active") ||
      error.message.startsWith("This user is already a member") ||
      error.message.startsWith("User is not a member") ||
      error.message.startsWith("Cannot change") ||
      error.message.startsWith("Cannot remove") ||
      error.message.startsWith("New owner must be") ||
      error.message.startsWith("Cannot transfer");

    if (isDomainError) {
      return error.message;
    }
  }

  return fallbackMessage;
}

/**
 * Creates a new team workspace inside an atomic transaction.
 * 1. Creates Team with caller as ownerId.
 * 2. Links caller as TeamMember with role = OWNER (BR-TEAM-01, BR-TEAM-02).
 * 3. Updates caller's lastActiveTeamId to the newly created team.
 * 4. Writes an immutable ActivityLog entry (REQ-LOG-01, BR-AUDIT-01).
 */
export async function createTeamAction(
  input: unknown
): Promise<ActionResult<{ teamId: string; name: string }>> {
  const user = await getActionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = createTeamSchema.safeParse(input);

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

  const { name, description } = parseResult.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock caller user row (FOR NO KEY UPDATE) and verify account is still active
      await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${user.id} FOR NO KEY UPDATE`;

      const activeUser = await tx.user.findUnique({
        where: { id: user.id },
      });

      if (!activeUser || activeUser.deletedAt !== null) {
        throw new Error("This account is no longer active.");
      }

      // 2. Create Team record
      const team = await tx.team.create({
        data: {
          name,
          description: description || null,
          ownerId: user.id,
        },
      });

      // 3. Link creator as OWNER in team_member
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      // 4. Set lastActiveTeamId as navigation preference
      await tx.user.update({
        where: { id: user.id },
        data: { lastActiveTeamId: team.id },
      });

      // 5. Record ActivityLog
      await recordActivityLog(tx, {
        teamId: team.id,
        actorId: user.id,
        action: "team_created",
        metadata: {
          teamName: team.name,
        },
      });

      return team;
    });

    revalidatePath("/teams");
    revalidatePath(`/teams/${result.id}`);

    return {
      success: true,
      data: {
        teamId: result.id,
        name: result.name,
      },
    };
  } catch (error) {
    console.error("[createTeamAction] Failed to create team:", error);

    return {
      success: false,
      error: sanitizeActionError(error, "Failed to create team. Please try again."),
    };
  }
}

/**
 * Adds an existing registered user to a team as MANAGER or MEMBER.
 * OWNER only. Uses direct email lookup (no invitation workflow).
 * Runs inside a Prisma transaction with team row locking for concurrency safety.
 */
export async function addMemberAction(
  input: unknown
): Promise<ActionResult<{ teamId: string; addedUserId: string }>> {
  const user = await getActionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = addMemberSchema.safeParse(input);

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

  const { teamId, email: rawEmail, role } = parseResult.data;
  const email = rawEmail.trim();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Acquire team row lock for concurrency safety (compatible with FOR KEY SHARE FKs)
      await tx.$queryRaw`SELECT id FROM "team" WHERE id = ${teamId} FOR NO KEY UPDATE`;

      // Re-check OWNER authorization after acquiring lock (inside transaction)
      const membership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: user.id } },
        include: { team: true },
      });

      if (!membership || membership.team.deletedAt !== null) {
        throw new Error("Forbidden: Not an active member of this team.");
      }

      if (membership.role !== "OWNER") {
        throw new Error("Forbidden: Only the team owner can add members.");
      }

      // Look up target user by email (case-sensitive exact match after trim)
      const initialUser = await tx.user.findUnique({
        where: { email },
      });

      if (!initialUser) {
        throw new Error("User with this email address was not found.");
      }

      // Reject soft-deleted accounts immediately if already deleted
      if (initialUser.deletedAt !== null) {
        throw new Error("This account is no longer active.");
      }

      // Lock target user row ("team" -> "user" lock order, compatible with FOR KEY SHARE) and re-check deletedAt
      await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${initialUser.id} FOR NO KEY UPDATE`;

      const targetUser = await tx.user.findUnique({
        where: { id: initialUser.id },
      });

      if (!targetUser || targetUser.deletedAt !== null) {
        throw new Error("This account is no longer active.");
      }

      // Reject duplicate membership
      const existingMembership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: targetUser.id } },
      });

      if (existingMembership) {
        throw new Error("This user is already a member of the team.");
      }

      // Create the membership
      await tx.teamMember.create({
        data: {
          teamId,
          userId: targetUser.id,
          role,
        },
      });

      // Write ActivityLog (non-PII; excludes email per BR-DEL-02 / BR-AUDIT-01)
      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        action: "member_added",
        metadata: {
          addedUserId: targetUser.id,
          role,
        },
      });

      return { teamId, addedUserId: targetUser.id };
    });

    revalidatePath(`/teams/${teamId}/settings`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[addMemberAction] Failed to add member:", error);

    return {
      success: false,
      error: sanitizeActionError(error, "Failed to add member. Please try again."),
    };
  }
}

/**
 * Updates an existing member's role (MANAGER or MEMBER only).
 * OWNER only. Cannot change the OWNER's role or the caller's own role.
 * Runs inside a Prisma transaction with team row locking.
 */
export async function updateMemberRoleAction(
  input: unknown
): Promise<ActionResult<{ teamId: string; userId: string; role: string }>> {
  const user = await getActionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = updateMemberRoleSchema.safeParse(input);

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

  const { teamId, userId, role } = parseResult.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Acquire team row lock for concurrency safety (compatible with FOR KEY SHARE FKs)
      await tx.$queryRaw`SELECT id FROM "team" WHERE id = ${teamId} FOR NO KEY UPDATE`;

      // Re-check OWNER authorization after acquiring lock (inside transaction)
      const membership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: user.id } },
        include: { team: true },
      });

      if (!membership || membership.team.deletedAt !== null) {
        throw new Error("Forbidden: Not an active member of this team.");
      }

      if (membership.role !== "OWNER") {
        throw new Error("Forbidden: Only the team owner can change member roles.");
      }

      // Look up target membership
      const targetMembership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        include: { team: true },
      });

      if (!targetMembership || targetMembership.team.deletedAt !== null) {
        throw new Error("User is not a member of this team.");
      }

      // Cannot change your own role
      if (userId === user.id) {
        throw new Error("Cannot change your own role.");
      }

      // Cannot change the OWNER's role via regular member management
      if (targetMembership.role === "OWNER") {
        throw new Error("Cannot change the team owner's role via regular member management.");
      }

      // Skip DB write and ActivityLog on no-op role updates
      if (targetMembership.role === role) {
        return { changed: false as const, teamId, userId, role };
      }

      // Update the role
      await tx.teamMember.update({
        where: { teamId_userId: { teamId, userId } },
        data: { role },
      });

      // Write ActivityLog
      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        action: "member_role_updated",
        metadata: {
          targetUserId: userId,
          previousRole: targetMembership.role,
          newRole: role,
        },
      });

      return { changed: true as const, teamId, userId, role };
    });

    if (result.changed) {
      revalidatePath(`/teams/${teamId}/settings`);
    }

    return {
      success: true,
      data: {
        teamId: result.teamId,
        userId: result.userId,
        role: result.role,
      },
    };
  } catch (error) {
    console.error("[updateMemberRoleAction] Failed to update member role:", error);

    return {
      success: false,
      error: sanitizeActionError(error, "Failed to update member role. Please try again."),
    };
  }
}

/**
 * Removes a member from a team.
 * OWNER only. Cannot remove the OWNER or self.
 * Checks for assigned tasks before removal (ON DELETE RESTRICT FK is final safeguard).
 * Runs inside a Prisma transaction with team row locking.
 */
export async function removeMemberAction(
  input: unknown
): Promise<ActionResult<{ teamId: string; removedUserId: string }>> {
  const user = await getActionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = removeMemberSchema.safeParse(input);

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

  const { teamId, userId } = parseResult.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Acquire team row lock for concurrency safety (compatible with FOR KEY SHARE FKs)
      await tx.$queryRaw`SELECT id FROM "team" WHERE id = ${teamId} FOR NO KEY UPDATE`;

      // Re-check OWNER authorization after acquiring lock (inside transaction)
      const membership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: user.id } },
        include: { team: true },
      });

      if (!membership || membership.team.deletedAt !== null) {
        throw new Error("Forbidden: Not an active member of this team.");
      }

      if (membership.role !== "OWNER") {
        throw new Error("Forbidden: Only the team owner can remove members.");
      }

      // Look up target membership
      const targetMembership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        include: { team: true },
      });

      if (!targetMembership || targetMembership.team.deletedAt !== null) {
        throw new Error("User is not a member of this team.");
      }

      // Cannot remove yourself
      if (userId === user.id) {
        throw new Error("Cannot remove yourself from the team.");
      }

      // Cannot remove the current OWNER
      if (targetMembership.role === "OWNER") {
        throw new Error("Cannot remove the team owner. Transfer ownership first.");
      }

      // Check for assigned tasks (friendly pre-check; FK RESTRICT is final safeguard)
      const assignedTask = await tx.task.findFirst({
        where: { teamId, assignedToId: userId, deletedAt: null },
      });

      if (assignedTask) {
        throw new Error(
          "Cannot remove this member because they have assigned tasks. Reassign or complete those tasks first."
        );
      }

      // Lock target user row to serialize concurrent switchTeamAction / deleteAccountAction
      await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId} FOR NO KEY UPDATE`;

      // Re-check active membership after acquiring user lock to avoid P2025 on concurrent account deletion
      const refreshedMembership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        include: { team: true },
      });

      if (!refreshedMembership || refreshedMembership.team.deletedAt !== null) {
        throw new Error("User is not a member of this team.");
      }

      // Remove the membership
      await tx.teamMember.delete({
        where: { teamId_userId: { teamId, userId } },
      });

      // BR-CTX-02: Reset lastActiveTeamId if user was removed from their active team
      const targetUser = await tx.user.findUnique({
        where: { id: userId },
        select: { lastActiveTeamId: true },
      });

      if (targetUser?.lastActiveTeamId === teamId) {
        const nextMembership = await tx.teamMember.findFirst({
          where: {
            userId,
            team: { deletedAt: null },
          },
          orderBy: [{ joinedAt: "asc" }, { teamId: "asc" }],
          select: { teamId: true },
        });

        await tx.user.update({
          where: { id: userId },
          data: { lastActiveTeamId: nextMembership?.teamId ?? null },
        });
      }

      // Write ActivityLog
      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        action: "member_removed",
        metadata: {
          removedUserId: userId,
        },
      });

      return { teamId, removedUserId: userId };
    });

    revalidatePath(`/teams/${teamId}/settings`);
    revalidatePath("/teams");

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[removeMemberAction] Failed to remove member:", error);

    return {
      success: false,
      error: sanitizeActionError(error, "Failed to remove member. Please try again."),
    };
  }
}

/**
 * Transfers team ownership to another active member.
 * OWNER only. Previous owner becomes MANAGER. Rejects self-transfer.
 * All changes run atomically inside a single Prisma transaction.
 * The deferred ownership invariant trigger validates at COMMIT.
 */
export async function transferOwnershipAction(
  input: unknown
): Promise<ActionResult<{ teamId: string; previousOwnerId: string; newOwnerId: string }>> {
  const user = await getActionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = transferOwnershipSchema.safeParse(input);

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

  const { teamId, newOwnerUserId } = parseResult.data;

  // Reject self-transfer at application level
  if (newOwnerUserId === user.id) {
    return {
      success: false,
      error: "Cannot transfer ownership to yourself.",
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Acquire team row lock for concurrency safety (compatible with FOR KEY SHARE FKs)
      await tx.$queryRaw`SELECT id FROM "team" WHERE id = ${teamId} FOR NO KEY UPDATE`;

      // Re-check OWNER authorization after acquiring lock (inside transaction)
      const membership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: user.id } },
        include: { team: true },
      });

      if (!membership || membership.team.deletedAt !== null) {
        throw new Error("Forbidden: Not an active member of this team.");
      }

      if (membership.role !== "OWNER") {
        throw new Error("Forbidden: Only the team owner can transfer ownership.");
      }

      // Lock recipient user row ("team" -> "user" lock order, compatible with FOR KEY SHARE) to serialize with account deletion
      await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${newOwnerUserId} FOR NO KEY UPDATE`;

      const recipientUser = await tx.user.findUnique({
        where: { id: newOwnerUserId },
      });

      if (!recipientUser || recipientUser.deletedAt !== null) {
        throw new Error("Cannot transfer ownership to a deactivated account.");
      }

      // Verify new owner is an active member of the same team
      const newOwnerMembership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: newOwnerUserId } },
        include: { team: true },
      });

      if (!newOwnerMembership || newOwnerMembership.team.deletedAt !== null) {
        throw new Error("New owner must be an active member of this team.");
      }

      // Demote original owner to MANAGER first
      // (Enforces BR-TEAM-04 and satisfies idx_team_single_owner partial unique index)
      await tx.teamMember.update({
        where: { teamId_userId: { teamId, userId: user.id } },
        data: { role: "MANAGER" },
      });

      // Promote recipient to OWNER second
      await tx.teamMember.update({
        where: { teamId_userId: { teamId, userId: newOwnerUserId } },
        data: { role: "OWNER" },
      });

      // Update team.ownerId
      await tx.team.update({
        where: { id: teamId },
        data: { ownerId: newOwnerUserId },
      });

      // Write ActivityLog
      await recordActivityLog(tx, {
        teamId,
        actorId: user.id,
        action: "ownership_transferred",
        metadata: {
          previousOwnerId: user.id,
          newOwnerId: newOwnerUserId,
        },
      });

      return {
        teamId,
        previousOwnerId: user.id,
        newOwnerId: newOwnerUserId,
      };
    });

    revalidatePath(`/teams/${teamId}/settings`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[transferOwnershipAction] Failed to transfer ownership:", error);

    return {
      success: false,
      error: sanitizeActionError(error, "Failed to transfer ownership. Please try again."),
    };
  }
}

/**
 * Fetches team members for a given team.
 * Server Action wrapper for use from client components.
 * Enforces NFR-SEC-01: authenticates caller, verifies active membership,
 * ensures team is not soft-deleted, and prevents team ID enumeration.
 */
export async function getTeamMembersAction(
  teamId: string
): Promise<{ success: true; data: Awaited<ReturnType<typeof getTeamMembers>> } | { success: false; error: string }> {
  const user = await getActionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = switchTeamSchema.safeParse({ teamId });
  if (!parseResult.success) {
    return {
      success: false,
      error: "Team not found.",
    };
  }

  const { teamId: validatedTeamId } = parseResult.data;

  try {
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: validatedTeamId,
          userId: user.id,
        },
      },
      include: {
        team: true,
      },
    });

    if (!membership || membership.team.deletedAt !== null) {
      return {
        success: false,
        error: "Team not found.",
      };
    }

    const members = await getTeamMembers(validatedTeamId);
    return { success: true, data: members };
  } catch (error) {
    console.error("[getTeamMembersAction] Failed to fetch members:", error);
    return { success: false, error: "Failed to load team members." };
  }
}

export type ActiveTeamContextResolution =
  | {
      status: "VALID";
      activeTeamId: string;
      role: TeamRole;
      userId: string;
    }
  | {
      status: "SWITCH_REQUIRED";
      activeTeamId: string;
      role: TeamRole;
      userId: string;
    }
  | {
      status: "NO_TEAMS";
      userId: string;
    }
  | {
      status: "UNAUTHENTICATED";
    }
  | {
      status: "ERROR";
      message: string;
    };

/**
 * Updates user's lastActiveTeamId preference after validating active membership.
 * Uses a transaction and user-row lock to serialize against concurrent membership removal.
 * Enforces BR-CTX-01: lastActiveTeamId is strictly a navigation preference.
 */
export async function switchTeamAction(
  teamId: string
): Promise<ActionResult<{ teamId: string }>> {
  const user = await getActionUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parseResult = switchTeamSchema.safeParse({ teamId });
  if (!parseResult.success) {
    return {
      success: false,
      error: "Invalid team ID.",
    };
  }

  const { teamId: validatedTeamId } = parseResult.data;

  try {
    await prisma.$transaction(async (tx) => {
      // Lock user row to serialize with removeMemberAction BR-CTX-02 cleanup
      await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${user.id} FOR NO KEY UPDATE`;

      // Authoritative check: verify active membership in targeted team
      const membership = await tx.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: validatedTeamId,
            userId: user.id,
          },
        },
        include: {
          team: true,
        },
      });

      if (!membership || membership.team.deletedAt !== null) {
        throw new Error("Forbidden: You are not an active member of this team.");
      }

      await tx.user.update({
        where: { id: user.id },
        data: { lastActiveTeamId: validatedTeamId },
      });
    });

    revalidatePath("/teams");

    return {
      success: true,
      data: { teamId: validatedTeamId },
    };
  } catch (error) {
    console.error("[switchTeamAction] Failed to update team preference:", error);

    return {
      success: false,
      error: sanitizeActionError(error, "Failed to update team preference."),
    };
  }
}

/**
 * Database-authoritative resolution of the user's current active team context.
 * Validates session, active memberships, and team deletion status.
 * Distinguishes temporary DB failures (ERROR) from unauthenticated or invalid team states.
 */
export async function resolveActiveTeamContextAction(
  currentTeamId?: string
): Promise<ActiveTeamContextResolution> {
  try {
    const user = await getActionUser();

    if (!user) {
      return { status: "UNAUTHENTICATED" };
    }

    const activeMemberships = await prisma.teamMember.findMany({
      where: {
        userId: user.id,
        team: { deletedAt: null },
      },
      orderBy: [{ joinedAt: "asc" }, { teamId: "asc" }],
      select: {
        teamId: true,
        role: true,
      },
    });

    if (activeMemberships.length === 0) {
      return {
        status: "NO_TEAMS",
        userId: user.id,
      };
    }

    // Never trust lastActiveTeamId blindly; verify it exists in activeMemberships
    const preferredMembership = user.lastActiveTeamId
      ? activeMemberships.find((m) => m.teamId === user.lastActiveTeamId)
      : undefined;

    const targetMembership = preferredMembership ?? activeMemberships[0]!;

    if (currentTeamId && targetMembership.teamId === currentTeamId) {
      return {
        status: "VALID",
        activeTeamId: targetMembership.teamId,
        role: targetMembership.role,
        userId: user.id,
      };
    }

    return {
      status: "SWITCH_REQUIRED",
      activeTeamId: targetMembership.teamId,
      role: targetMembership.role,
      userId: user.id,
    };
  } catch (error) {
    console.error("[resolveActiveTeamContextAction] Failed to resolve team context:", error);
    return {
      status: "ERROR",
      message: "Unable to verify active workspace.",
    };
  }
}
