import { redirect } from "next/navigation";
import { requireAuthPage } from "@/features/auth/server";
import { getUserTeams } from "@/features/teams/server";
import { TeamsOnboarding } from "@/features/teams/components/teams-onboarding";

export const instant = false;

export default async function TeamsIndexPage() {
  const user = await requireAuthPage("/sign-in");
  const userTeams = await getUserTeams(user.id);

  if (userTeams.length > 0) {
    const targetTeam = user.lastActiveTeamId
      ? userTeams.find((t) => t.id === user.lastActiveTeamId)
      : null;

    const destinationId = targetTeam ? targetTeam.id : userTeams[0]!.id;
    redirect(`/teams/${destinationId}`);
  }

  return <TeamsOnboarding userName={user.name} />;
}
