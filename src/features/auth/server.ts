import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";

export type AuthFailureReason = "NO_SESSION" | "USER_NOT_FOUND" | "USER_DELETED";

export type AuthSuccess = {
  success: true;
  status: "AUTHENTICATED";
  user: User;
  reason: null;
};

export type AuthFailure = {
  success: false;
  status: AuthFailureReason;
  user: null;
  reason: AuthFailureReason;
};

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Validates the current session and checks the application user state in the database.
 * Memoized per RSC request via React cache() to eliminate duplicate session/user lookups
 * between layouts, pages, and server query helpers without sharing across requests/users.
 *
 * NOTE: Authentication proves identity only. Team authorization (membership, RBAC)
 * must be verified separately per target teamId (BR-CTX-01).
 */
export const getAuthenticatedUser = cache(async (): Promise<AuthResult> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      status: "NO_SESSION",
      user: null,
      reason: "NO_SESSION",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return {
      success: false,
      status: "USER_NOT_FOUND",
      user: null,
      reason: "USER_NOT_FOUND",
    };
  }

  if (user.deletedAt !== null) {
    return {
      success: false,
      status: "USER_DELETED",
      user: null,
      reason: "USER_DELETED",
    };
  }

  return {
    success: true,
    status: "AUTHENTICATED",
    user,
    reason: null,
  };
});

/**
 * Ensures the user is authenticated and active for server-rendered pages.
 * Redirects unauthenticated or soft-deleted users to the specified login path.
 *
 * NOTE: Proves user authentication only; team access must be checked separately.
 */
export async function requireAuthPage(
  redirectTo: string = "/sign-in"
): Promise<User> {
  const authResult = await getAuthenticatedUser();

  if (!authResult.success) {
    redirect(redirectTo);
  }

  return authResult.user;
}

/**
 * Obtains the authenticated active user for Server Actions without redirecting
 * or throwing HTTP response errors. Returns null if unauthenticated, not found, or deleted.
 *
 * NOTE: Proves user authentication only; team access must be checked separately.
 */
export async function getActionUser(): Promise<User | null> {
  const authResult = await getAuthenticatedUser();

  if (!authResult.success) {
    return null;
  }

  return authResult.user;
}
