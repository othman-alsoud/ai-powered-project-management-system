import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getTeamProjectOptions, getTeamProjects, getProjectById } from "../server";

const teamId = "550e8400-e29b-41d4-a716-446655440001";
const projectId = "550e8400-e29b-41d4-a716-446655440002";

describe("Project Server Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTeamProjects", () => {
    it("queries non-deleted projects scoped to active team, ordered by createdAt desc with non-deleted task counts", async () => {
      const createdAt = new Date("2026-11-20T10:00:00Z");
      const updatedAt = new Date("2026-11-21T10:00:00Z");

      vi.mocked(prisma.project.findMany).mockResolvedValueOnce([
        {
          id: projectId,
          teamId,
          name: "API Hardening",
          description: "Security pass",
          status: "ACTIVE",
          startDate: new Date("2026-11-01T00:00:00Z"),
          endDate: new Date("2026-12-01T00:00:00Z"),
          createdById: "user-1",
          updatedById: "user-2",
          createdAt,
          updatedAt,
          deletedAt: null,
          createdBy: {
            id: "user-1",
            name: "Alice Owner",
            image: null,
            deletedAt: null,
          },
          updatedBy: {
            id: "user-2",
            name: "Original Name",
            image: "https://example.com/avatar.png",
            deletedAt: new Date("2026-11-22T00:00:00Z"),
          },
          _count: { tasks: 4 },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.project.findMany>>);

      const projects = await getTeamProjects(teamId);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          teamId,
          deletedAt: null,
          team: { deletedAt: null },
        },
        include: {
          createdBy: { select: { id: true, name: true, image: true, deletedAt: true } },
          updatedBy: { select: { id: true, name: true, image: true, deletedAt: true } },
          _count: {
            select: {
              tasks: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });

      expect(projects).toEqual([
        {
          id: projectId,
          teamId,
          name: "API Hardening",
          description: "Security pass",
          status: "ACTIVE",
          startDate: new Date("2026-11-01T00:00:00Z"),
          endDate: new Date("2026-12-01T00:00:00Z"),
          createdAt,
          updatedAt,
          taskCount: 4,
          createdBy: { id: "user-1", name: "Alice Owner", image: null },
          updatedBy: { id: "user-2", name: "Deleted User", image: null },
        },
      ]);
    });

    it("supports deterministic project sorting by name and endDate (nulls last)", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await getTeamProjects(teamId, { sort: "name", dir: "asc" });
      expect(prisma.project.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          orderBy: [{ name: "asc" }, { createdAt: "desc" }, { id: "asc" }],
        }),
      );

      await getTeamProjects(teamId, { sort: "endDate", dir: "asc" });
      expect(prisma.project.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          orderBy: [
            { endDate: { sort: "asc", nulls: "last" } },
            { createdAt: "desc" },
            { id: "asc" },
          ],
        }),
      );
    });
    it("returns lightweight project options without user joins or task counts", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValueOnce([
        { id: projectId, name: "API Hardening" },
      ] as unknown as Awaited<ReturnType<typeof prisma.project.findMany>>);

      const options = await getTeamProjectOptions(teamId);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          teamId,
          deletedAt: null,
          team: { deletedAt: null },
        },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      expect(options).toEqual([{ id: projectId, name: "API Hardening" }]);
    });
  });

  describe("getProjectById", () => {
    it("looks up project via composite id_teamId and returns detail when active", async () => {
      const createdAt = new Date("2026-11-20T10:00:00Z");
      const updatedAt = new Date("2026-11-20T10:00:00Z");

      vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
        id: projectId,
        teamId,
        name: "Milestone 2.1",
        description: null,
        status: "PLANNING",
        startDate: null,
        endDate: null,
        createdById: "user-1",
        updatedById: null,
        createdAt,
        updatedAt,
        deletedAt: null,
        team: { deletedAt: null },
        createdBy: { id: "user-1", name: "Deleted User", image: null, deletedAt: new Date() },
        updatedBy: null,
        _count: { tasks: 0 },
      } as unknown as Awaited<ReturnType<typeof prisma.project.findUnique>>);

      const project = await getProjectById(projectId, teamId);

      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id_teamId: { id: projectId, teamId } },
        include: {
          team: { select: { deletedAt: true } },
          createdBy: { select: { id: true, name: true, image: true, deletedAt: true } },
          updatedBy: { select: { id: true, name: true, image: true, deletedAt: true } },
          _count: {
            select: {
              tasks: { where: { deletedAt: null } },
            },
          },
        },
      });
      expect(project?.createdBy.name).toBe("Deleted User");
      expect(project?.taskCount).toBe(0);
    });

    it("returns null if project is missing, soft-deleted, or belongs to a soft-deleted team", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);
      expect(await getProjectById(projectId, teamId)).toBeNull();

      vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
        id: projectId,
        teamId,
        deletedAt: new Date(),
        team: { deletedAt: null },
      } as unknown as Awaited<ReturnType<typeof prisma.project.findUnique>>);
      expect(await getProjectById(projectId, teamId)).toBeNull();

      vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
        id: projectId,
        teamId,
        deletedAt: null,
        team: { deletedAt: new Date() },
      } as unknown as Awaited<ReturnType<typeof prisma.project.findUnique>>);
      expect(await getProjectById(projectId, teamId)).toBeNull();
    });

    it("returns null for malformed non-UUID projectId without calling Prisma", async () => {
      const res = await getProjectById("not-a-valid-uuid", teamId);
      expect(res).toBeNull();
      expect(prisma.project.findUnique).not.toHaveBeenCalled();
    });
  });
});
