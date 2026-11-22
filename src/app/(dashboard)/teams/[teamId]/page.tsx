import { requireTeamMember } from "@/features/teams/server";

export const instant = false;

interface TeamDashboardPageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamDashboardPage(props: TeamDashboardPageProps) {
  const { teamId } = await props.params;
  const { team, role } = await requireTeamMember(teamId);

  return (
    <main id="main-content" className="flex-1 p-6 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-1 border-b border-[--color-border-subtle] pb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">
            Workspace
          </span>
          <span className="text-xs text-[--color-text-muted]">/</span>
          <span className="text-xs font-medium text-[--color-text-secondary]">
            {role}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[--color-text-primary]">
          Dashboard / {team.name}
        </h1>
        {team.description && (
          <p className="mt-1 text-sm text-[--color-text-secondary]">
            {team.description}
          </p>
        )}
      </div>

      {/* Dashboard Content Overview Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Projects Card */}
        <div className="rounded-lg border border-[--color-border-subtle] bg-[--color-bg-surface] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[--color-text-muted]">
              Projects
            </h2>
            <span className="text-xs font-medium text-[--color-accent-primary]">
              Milestone 2.1
            </span>
          </div>
          <p className="mt-4 text-2xl font-bold text-[--color-text-primary]">0</p>
          <p className="mt-1 text-xs text-[--color-text-secondary]">
            Active projects in this workspace
          </p>
        </div>

        {/* Tasks Card */}
        <div className="rounded-lg border border-[--color-border-subtle] bg-[--color-bg-surface] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[--color-text-muted]">
              Tasks
            </h2>
            <span className="text-xs font-medium text-[--color-accent-primary]">
              Milestone 2.2
            </span>
          </div>
          <p className="mt-4 text-2xl font-bold text-[--color-text-primary]">0</p>
          <p className="mt-1 text-xs text-[--color-text-secondary]">
            Tasks in progress and review
          </p>
        </div>

        {/* Team Role Card */}
        <div className="rounded-lg border border-[--color-border-subtle] bg-[--color-bg-surface] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[--color-text-muted]">
              Your Access
            </h2>
            <span className="rounded border border-[--color-accent-primary]/30 bg-[--color-accent-primary]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[--color-accent-primary]">
              {role}
            </span>
          </div>
          <p className="mt-4 text-sm font-medium text-[--color-text-primary]">
            Full workspace permissions enabled
          </p>
          <p className="mt-1 text-xs text-[--color-text-secondary]">
            Scoped to team ID: {team.id}
          </p>
        </div>
      </div>
    </main>
  );
}
