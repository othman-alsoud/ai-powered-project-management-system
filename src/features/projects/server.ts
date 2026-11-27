import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma, ProjectStatus } from "@/generated/prisma/client";
import {
  parseProjectQueryParams,
  type ProjectQueryParams,
} from "./validation";

const projectIdSchema = z.string().uuid();

export type { ProjectStatus };

export type ProjectAuthorSummary = {
  id: string;
  name: string;
  image: string | null;
};

export type ProjectSummary = {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  taskCount: number;
  createdBy: ProjectAuthorSummary;
  updatedBy: ProjectAuthorSummary | null;
};

export type ProjectDetail = ProjectSummary;

function formatProjectAuthor(user: {
  id: string;
  name: string;
  image: string | null;
  deletedAt: Date | null;
}): ProjectAuthorSummary {
  if (user.deletedAt !== null) {
    return {
      id: user.id,
      name: "Deleted User",
      image: null,
    };
  }

  return {
    id: user.id,
    name: user.name,
    image: user.image,
  };
}

function buildProjectOrderBy(
  params: ProjectQueryParams,
): Prisma.ProjectOrderByWithRelationInput[] {
  if (params.sort === "endDate") {
    return [
      { endDate: { sort: params.dir, nulls: "last" } },
      { createdAt: "desc" },
      { id: "asc" },
    ];
  }
  if (params.sort === "name") {
    return [
      { name: params.dir },
      { createdAt: "desc" },
      { id: "asc" },
    ];
  }
  return [{ createdAt: params.dir }, { id: "asc" }];
}

export type ProjectOption = {
  id: string;
  name: string;
};

/**
 * Lightweight active project selector options for filter dropdowns (omits author joins & task counts).
 */
export async function getTeamProjectOptions(
  teamId: string,
): Promise<ProjectOption[]> {
  return prisma.project.findMany({
    where: {
      teamId,
      deletedAt: null,
      team: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

/**
 * Lists all active (non-deleted) projects belonging to an active team,
 * deterministically ordered by the requested sort field with stable tie-breakers.
 */
export async function getTeamProjects(
  teamId: string,
  query?: Partial<ProjectQueryParams>,
): Promise<ProjectSummary[]> {
  const normalizedQuery = parseProjectQueryParams(
    query
      ? {
          sort: query.sort,
          dir: query.dir,
        }
      : undefined,
  );

  const projects = await prisma.project.findMany({
    where: {
      teamId,
      deletedAt: null,
      team: {
        deletedAt: null,
      },
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          image: true,
          deletedAt: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          image: true,
          deletedAt: true,
        },
      },
      _count: {
        select: {
          tasks: {
            where: { deletedAt: null },
          },
        },
      },
    },
    orderBy: buildProjectOrderBy(normalizedQuery),
  });

  return projects.map((project) => ({
    id: project.id,
    teamId: project.teamId,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    taskCount: project._count.tasks,
    createdBy: formatProjectAuthor(project.createdBy),
    updatedBy: project.updatedBy ? formatProjectAuthor(project.updatedBy) : null,
  }));
}

/**
 * Retrieves an active project using its composite [id, teamId] identity.
 * Returns null if missing, soft-deleted, belonging to another team, or inside a deleted team.
 */
export async function getProjectById(
  projectId: string,
  teamId: string
): Promise<ProjectDetail | null> {
  if (!projectIdSchema.safeParse(projectId).success) {
    return null;
  }

  const project = await prisma.project.findUnique({
    where: {
      id_teamId: {
        id: projectId,
        teamId,
      },
    },
    include: {
      team: {
        select: { deletedAt: true },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          image: true,
          deletedAt: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          image: true,
          deletedAt: true,
        },
      },
      _count: {
        select: {
          tasks: {
            where: { deletedAt: null },
          },
        },
      },
    },
  });

  if (!project || project.deletedAt !== null || project.team.deletedAt !== null) {
    return null;
  }

  return {
    id: project.id,
    teamId: project.teamId,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    taskCount: project._count.tasks,
    createdBy: formatProjectAuthor(project.createdBy),
    updatedBy: project.updatedBy ? formatProjectAuthor(project.updatedBy) : null,
  };
}
