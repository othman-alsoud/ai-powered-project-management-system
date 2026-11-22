import { requireTeamMember, getUserTeams } from "@/features/teams/server";
import { WorkspaceSidebar } from "@/features/teams/components/sidebar";

export const instant = false;

interface TeamWorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}

export default async function TeamWorkspaceLayout(props: TeamWorkspaceLayoutProps) {
  const { teamId } = await props.params;

  // Authoritative server-side tenant boundary check: triggers notFound() if unauthorized
  const { user, team, role } = await requireTeamMember(teamId);
  const userTeams = await getUserTeams(user.id);

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row bg-[--color-bg-base]">
      <WorkspaceSidebar
        currentTeam={{ id: team.id, name: team.name }}
        currentRole={role}
        userTeams={userTeams}
        currentUser={{
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }}
      />
      <div className="flex flex-1 flex-col overflow-y-auto">
        {props.children}
      </div>
    </div>
  );
}
