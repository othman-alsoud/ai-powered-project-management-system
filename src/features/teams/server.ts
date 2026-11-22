import { notFound, redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/features/auth/server";
import { prisma } from "@/lib/prisma";
import type { Team, TeamMember, TeamRole, User } from "@/generated/prisma/client";

export type UserTeamSummary = {
  id: string;
  name: string;
  description: string | null;
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
 * Enforces BR-SCOPE-01: strict tenant isolation.
 */
export async function getTeamById(
  teamId: string,
  userId: string
): Promise<{ team: Team; membership: TeamMember } | null> {
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
}

/**
 * Returns all active teams that a user belongs to.
 */
export async function getUserTeams(userId: string): Promise<UserTeamSummary[]> {
  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      team: {
        deletedAt: null,
      },
    },
    include: {
      team: true,
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
}

/**
 * Authoritative server-side guard for team workspace routes.
 * 1. Verifies authentication session. If none, redirects to /sign-in.
 * 2. Checks active membership in teamId. If not a member, triggers notFound()
 *    (preventing team ID enumeration).
 * 3. Enforces BR-CTX-01: Never trusts lastActiveTeamId for authorization.
 */
export async function requireTeamMember(teamId: string): Promise<TeamContext> {
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
}
