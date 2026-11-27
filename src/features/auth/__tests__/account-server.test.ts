import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    team: {
      findMany: vi.fn(),
    },
    task: {
      count: vi.fn(),
    },
    account: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getAccountDeletionEligibility } from "../account-server";

describe("getAccountDeletionEligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns eligible = true when user owns no teams and has no active assigned tasks", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.task.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.account.findMany).mockResolvedValueOnce([
      { providerId: "credential", password: "hashed-password" },
    ] as unknown as Awaited<ReturnType<typeof prisma.account.findMany>>);

    const result = await getAccountDeletionEligibility("user-1");

    expect(result).toEqual({
      eligible: true,
      ownedTeams: [],
      activeAssignedTaskCount: 0,
      hasPasswordAccount: true,
      authProviders: ["Email & Password"],
    });

    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: { ownerId: "user-1" },
      select: {
        id: true,
        name: true,
        deletedAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    expect(prisma.task.count).toHaveBeenCalledWith({
      where: {
        assignedToId: "user-1",
        deletedAt: null,
        status: { not: "DONE" },
      },
    });
  });

  it("returns eligible = false with ownedTeams and memberCount when user owns teams", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce([
      {
        id: "team-1",
        name: "Solo Workspace",
        deletedAt: null,
        _count: { members: 1 },
      },
      {
        id: "team-2",
        name: "Shared Workspace",
        deletedAt: new Date("2026-01-01"),
        _count: { members: 3 },
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.team.findMany>>);
    vi.mocked(prisma.task.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.account.findMany).mockResolvedValueOnce([
      { providerId: "google", password: null },
    ] as unknown as Awaited<ReturnType<typeof prisma.account.findMany>>);

    const result = await getAccountDeletionEligibility("user-1");

    expect(result).toEqual({
      eligible: false,
      ownedTeams: [
        { id: "team-1", name: "Solo Workspace", deletedAt: null, memberCount: 1 },
        {
          id: "team-2",
          name: "Shared Workspace",
          deletedAt: new Date("2026-01-01"),
          memberCount: 3,
        },
      ],
      activeAssignedTaskCount: 0,
      hasPasswordAccount: false,
      authProviders: ["Google OAuth"],
    });
  });

  it("returns eligible = false when user has active assigned tasks", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.task.count).mockResolvedValueOnce(4);
    vi.mocked(prisma.account.findMany).mockResolvedValueOnce([
      { providerId: "credential", password: "hash" },
      { providerId: "google", password: null },
    ] as unknown as Awaited<ReturnType<typeof prisma.account.findMany>>);

    const result = await getAccountDeletionEligibility("user-1");

    expect(result).toEqual({
      eligible: false,
      ownedTeams: [],
      activeAssignedTaskCount: 4,
      hasPasswordAccount: true,
      authProviders: ["Email & Password", "Google OAuth"],
    });
  });
});
