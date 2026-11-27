import { requireTeamMember } from "@/features/teams/server";
import { getTeamProjects } from "@/features/projects/server";
import { parseProjectQueryParams } from "@/features/projects/validation";
import { ProjectsManager } from "@/features/projects/components/projects-manager";

export const instant = false;

interface TeamProjectsPageProps {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TeamProjectsPage(props: TeamProjectsPageProps) {
  const [{ teamId }, resolvedSearchParams] = await Promise.all([
    props.params,
    props.searchParams ?? Promise.resolve({}),
  ]);
  const query = parseProjectQueryParams(resolvedSearchParams);
  const { role } = await requireTeamMember(teamId);
  const projects = await getTeamProjects(teamId, query);

  return (
    <main
      id="main-content"
      className="flex-1 p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950"
    >
      <div className="mx-auto max-w-7xl">
        <ProjectsManager
          teamId={teamId}
          projects={projects}
          currentUserRole={role}
          query={query}
        />
      </div>
    </main>
  );
}
