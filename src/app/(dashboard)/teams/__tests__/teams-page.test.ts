import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT: ${url}`);
  }),
}));

// Mock @/features/auth/server
vi.mock("@/features/auth/server", () => ({
  requireAuthPage: vi.fn(),
}));

// Mock @/features/teams/server
vi.mock("@/features/teams/server", () => ({
  getUserTeams: vi.fn(),
}));

// Mock @/lib/prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { redirect } from "next/navigation";
import { requireAuthPage } from "@/features/auth/server";
import { getUserTeams } from "@/features/teams/server";
import TeamsIndexPage from "../page";

describe("TeamsIndexPage routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to lastActiveTeamId when valid", async () => {
    vi.mocked(requireAuthPage).mockResolvedValueOnce({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      emailVerified: true,
      image: null,
      lastActiveTeamId: "team-2",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(getUserTeams).mockResolvedValueOnce([
      { id: "team-1", name: "Team 1", description: null, role: "MEMBER", joinedAt: new Date() },
      { id: "team-2", name: "Team 2", description: null, role: "OWNER", joinedAt: new Date() },
    ]);

    await expect(TeamsIndexPage()).rejects.toThrow("NEXT_REDIRECT: /teams/team-2");
    expect(redirect).toHaveBeenCalledWith("/teams/team-2");
  });

  it("redirects to first team if lastActiveTeamId is null or stale", async () => {
    vi.mocked(requireAuthPage).mockResolvedValueOnce({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      emailVerified: true,
      image: null,
      lastActiveTeamId: "team-removed",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(getUserTeams).mockResolvedValueOnce([
      { id: "team-alpha", name: "Team Alpha", description: null, role: "MEMBER", joinedAt: new Date() },
    ]);

    await expect(TeamsIndexPage()).rejects.toThrow("NEXT_REDIRECT: /teams/team-alpha");
    expect(redirect).toHaveBeenCalledWith("/teams/team-alpha");
  });

  it("renders onboarding component when user has 0 teams", async () => {
    vi.mocked(requireAuthPage).mockResolvedValueOnce({
      id: "user-new",
      name: "Newcomer",
      email: "new@example.com",
      emailVerified: true,
      image: null,
      lastActiveTeamId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(getUserTeams).mockResolvedValueOnce([]);

    const result = await TeamsIndexPage();
    expect(result).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("renders onboarding component when unverified user (emailVerified: false) has 0 teams", async () => {
    vi.mocked(requireAuthPage).mockResolvedValueOnce({
      id: "user-unverified",
      name: "Unverified User",
      email: "unverified@example.com",
      emailVerified: false,
      image: null,
      lastActiveTeamId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(getUserTeams).mockResolvedValueOnce([]);

    const result = await TeamsIndexPage();
    expect(result).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects unverified user (emailVerified: false) to their active workspace", async () => {
    vi.mocked(requireAuthPage).mockResolvedValueOnce({
      id: "user-unverified",
      name: "Unverified User",
      email: "unverified@example.com",
      emailVerified: false,
      image: null,
      lastActiveTeamId: "team-unverified-1",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(getUserTeams).mockResolvedValueOnce([
      { id: "team-unverified-1", name: "Alpha Workspace", description: null, role: "OWNER", joinedAt: new Date() },
    ]);

    await expect(TeamsIndexPage()).rejects.toThrow("NEXT_REDIRECT: /teams/team-unverified-1");
    expect(redirect).toHaveBeenCalledWith("/teams/team-unverified-1");
  });
});
