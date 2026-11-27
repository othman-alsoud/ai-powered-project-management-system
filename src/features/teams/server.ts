import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/features/auth/server";
import { prisma } from "@/lib/prisma";
import type { Team, TeamMember, TeamRole, User } from "@/generated/prisma/client";

export type { TeamRole };

export type UserTeamSummary = {
  id: string;
  name: string;
  description: string | null;
  role: TeamRole;
  joinedAt: Date;
};

export type TeamMemberSummary = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: TeamRole;
  joinedAt: Date;
};

export type TeamContext = {
  user: User;
  team: Team;
  membership: TeamMember;
  role: TeamRole;
};

/**
 * Retrieves a team by ID ONLY IF the specified user is an active member
 * and the team is not soft-deleted.
 * Memoized per request via React cache() and enforces BR-SCOPE-01: strict tenant isolation.
 */
export const getTeamById = cache(async (
  teamId: string,
  userId: string
): Promise<{ team: Team; membership: TeamMember } | null> => {
  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
    include: {
      team: true,
    },
  });

  if (!membership || membership.team.deletedAt !== null) {
    return null;
  }

  return {
    team: membership.team,
    membership,
  };
});

/**
 * Returns all active teams that a user belongs to (request-scoped memoized).
 */
export const getUserTeams = cache(async (userId: string): Promise<UserTeamSummary[]> => {
  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      team: {
        deletedAt: null,
      },
    },
    select: {
      role: true,
      joinedAt: true,
      team: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
    orderBy: {
      joinedAt: "asc",
    },
  });

  return memberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    description: m.team.description,
    role: m.role,
    joinedAt: m.joinedAt,
  }));
});

/**
 * Authoritative server-side guard for team workspace routes.
 * Memoized per request via React cache() so shared layout + page + server loaders
 * authenticate and verify team membership at most once per RSC render.
 * 1. Verifies authentication session. If none, redirects to /sign-in.
 * 2. Checks active membership in teamId. If not a member, triggers notFound()
 *    (preventing team ID enumeration).
 * 3. Enforces BR-CTX-01: Never trusts lastActiveTeamId for authorization.
 */
export const requireTeamMember = cache(async (teamId: string): Promise<TeamContext> => {
  const authResult = await getAuthenticatedUser();

  if (!authResult.success) {
    redirect("/sign-in");
  }

  const teamData = await getTeamById(teamId, authResult.user.id);

  if (!teamData) {
    notFound();
  }

  return {
    user: authResult.user,
    team: teamData.team,
    membership: teamData.membership,
    role: teamData.membership.role,
  };
});

/**
 * Returns all active members of a team with their user details and roles.
 * Enforces BR-SCOPE-01: strict tenant isolation.
 */
export async function getTeamMembers(teamId: string): Promise<TeamMemberSummary[]> {
  const memberships = await prisma.teamMember.findMany({
    where: {
      teamId,
      team: {
        deletedAt: null,
      },
    },
    select: {
      userId: true,
      role: true,
      joinedAt: true,
      user: {
        select: {
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: {
      joinedAt: "asc",
    },
  });

  return memberships.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
    role: m.role,
    joinedAt: m.joinedAt,
  }));
}

/**
 * Verifies the user is an OWNER of the team.
 * Enforces OWNER-only authorization for member management operations.
 * Never trusts lastActiveTeamId for authorization.
 */
export async function requireOwner(teamId: string, userId: string): Promise<TeamMember> {
  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
    include: {
      team: true,
    },
  });

  if (!membership || membership.team.deletedAt !== null) {
    throw new Error("Forbidden: Not an active member of this team.");
  }

  if (membership.role !== "OWNER") {
    throw new Error("Forbidden: Only the team owner can perform this action.");
  }

  return membership;
}
