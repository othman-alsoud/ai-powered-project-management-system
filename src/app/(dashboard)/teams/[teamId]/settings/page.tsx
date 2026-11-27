import { requireTeamMember, getTeamMembers } from "@/features/teams/server";
import { TeamMembersManager } from "@/features/teams/components/team-members-manager";
import { Badge } from "@/components/ui/badge";

export const instant = false;

interface TeamSettingsPageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamSettingsPage(props: TeamSettingsPageProps) {
  const { teamId } = await props.params;

  // Authoritative server-side tenant boundary check: triggers notFound() if unauthorized
  const { user, team, role } = await requireTeamMember(teamId);
  const members = await getTeamMembers(teamId);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header (docs/DESIGN_GUIDELINES.md §7.1) */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Workspace
            </span>
            <span aria-hidden="true" className="text-xs text-slate-500 dark:text-slate-400">/</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Settings
            </span>
            <span aria-hidden="true" className="text-xs text-slate-500 dark:text-slate-400">/</span>
            <Badge variant="teal" size="sm">
              {role}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Team Settings & Members
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manage workspace members, role assignments, and ownership for{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">{team.name}</span>.
          </p>
        </div>
      </div>

      {/* Interactive Member Management */}
      <TeamMembersManager
        teamId={teamId}
        initialMembers={members}
        currentUserRole={role}
        currentUserId={user.id}
      />
    </div>
  );
}
