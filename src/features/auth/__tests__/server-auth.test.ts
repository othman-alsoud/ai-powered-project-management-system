import { beforeEach, describe, expect, it, vi } from "vitest";

// 1. Explicitly mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// 2. Explicitly mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT: ${url}`);
  }),
}));

// 3. Explicitly mock @/lib/auth before importing server helpers
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// 4. Explicitly mock @/lib/prisma to ensure the real client and adapter are NEVER initialized
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Import dependencies and server helpers after mocks are established
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";
import {
  getActionUser,
  getAuthenticatedUser,
  requireAuthPage,
} from "../server";

const mockActiveUser: User = {
  id: "user-uuid-1234",
  name: "Active Test User",
  email: "active@example.com",
  emailVerified: true,
  image: "https://example.com/avatar.jpg",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  lastActiveTeamId: "team-uuid-1234",
  deletedAt: null,
};

const mockUnverifiedUser: User = {
  ...mockActiveUser,
  id: "user-uuid-unverified",
  email: "unverified@example.com",
  emailVerified: false,
};

const mockDeletedUser: User = {
  ...mockActiveUser,
  id: "user-uuid-deleted",
  email: "deleted_1234@deleted.local",
  deletedAt: new Date("2026-06-01T00:00:00Z"),
};

describe("Server Authentication Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAuthenticatedUser()", () => {
    it("returns authenticated user when session is valid and user is active", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-1234" },
        session: { id: "session-1", userId: "user-uuid-1234" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockActiveUser);

      const result = await getAuthenticatedUser();

      expect(result).toEqual({
        success: true,
        status: "AUTHENTICATED",
        user: mockActiveUser,
        reason: null,
      });

      // Verify Prisma lookup used the authenticated session user's ID
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-uuid-1234" },
      });
    });

    it("returns authenticated user when user is active even if email is unverified (emailVerified: false)", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-unverified" },
        session: { id: "session-unverified", userId: "user-uuid-unverified" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUnverifiedUser);

      const result = await getAuthenticatedUser();

      expect(result).toEqual({
        success: true,
        status: "AUTHENTICATED",
        user: mockUnverifiedUser,
        reason: null,
      });

      expect(result.user?.emailVerified).toBe(false);
    });

    it("returns USER_DELETED when user has deletedAt timestamp", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-deleted" },
        session: { id: "session-2", userId: "user-uuid-deleted" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockDeletedUser);

      const result = await getAuthenticatedUser();

      expect(result).toEqual({
        success: false,
        status: "USER_DELETED",
        user: null,
        reason: "USER_DELETED",
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-uuid-deleted" },
      });
    });

    it("returns USER_NOT_FOUND when user does not exist in the database", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-missing" },
        session: { id: "session-3", userId: "user-uuid-missing" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const result = await getAuthenticatedUser();

      expect(result).toEqual({
        success: false,
        status: "USER_NOT_FOUND",
        user: null,
        reason: "USER_NOT_FOUND",
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-uuid-missing" },
      });
    });

    it("returns NO_SESSION when Better Auth session is null", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      const result = await getAuthenticatedUser();

      expect(result).toEqual({
        success: false,
        status: "NO_SESSION",
        user: null,
        reason: "NO_SESSION",
      });

      // Prisma should never be queried when session is missing
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns NO_SESSION when session object lacks user id", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: null,
        session: null,
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      const result = await getAuthenticatedUser();

      expect(result).toEqual({
        success: false,
        status: "NO_SESSION",
        user: null,
        reason: "NO_SESSION",
      });

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("requireAuthPage()", () => {
    it("returns active user without redirecting when session is valid", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-1234" },
        session: { id: "session-1", userId: "user-uuid-1234" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockActiveUser);

      const user = await requireAuthPage();

      expect(user).toEqual(mockActiveUser);
      expect(redirect).not.toHaveBeenCalled();
    });

    it("allows unverified users (emailVerified: false) to access protected pages without redirecting", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-unverified" },
        session: { id: "session-unverified", userId: "user-uuid-unverified" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUnverifiedUser);

      const user = await requireAuthPage();

      expect(user).toEqual(mockUnverifiedUser);
      expect(user.emailVerified).toBe(false);
      expect(redirect).not.toHaveBeenCalled();
    });

    it("redirects to /sign-in by default when there is no session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      await expect(requireAuthPage()).rejects.toThrow("NEXT_REDIRECT: /sign-in");
      expect(redirect).toHaveBeenCalledWith("/sign-in");
    });

    it("redirects to custom URL when specified and unauthenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      await expect(requireAuthPage("/auth/sign-in")).rejects.toThrow(
        "NEXT_REDIRECT: /auth/sign-in"
      );
      expect(redirect).toHaveBeenCalledWith("/auth/sign-in");
    });

    it("redirects to /sign-in when user is soft-deleted", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-deleted" },
        session: { id: "session-2", userId: "user-uuid-deleted" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockDeletedUser);

      await expect(requireAuthPage()).rejects.toThrow("NEXT_REDIRECT: /sign-in");
      expect(redirect).toHaveBeenCalledWith("/sign-in");
    });

    it("redirects to /sign-in when user is not found in database", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-missing" },
        session: { id: "session-3", userId: "user-uuid-missing" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      await expect(requireAuthPage()).rejects.toThrow("NEXT_REDIRECT: /sign-in");
      expect(redirect).toHaveBeenCalledWith("/sign-in");
    });
  });

  describe("getActionUser()", () => {
    it("returns user object when session is valid and user is active", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-1234" },
        session: { id: "session-1", userId: "user-uuid-1234" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockActiveUser);

      const user = await getActionUser();

      expect(user).toEqual(mockActiveUser);
      expect(redirect).not.toHaveBeenCalled();
    });

    it("returns user object for unverified users (emailVerified: false) when session is valid and active", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-unverified" },
        session: { id: "session-unverified", userId: "user-uuid-unverified" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUnverifiedUser);

      const user = await getActionUser();

      expect(user).toEqual(mockUnverifiedUser);
      expect(user?.emailVerified).toBe(false);
      expect(redirect).not.toHaveBeenCalled();
    });

    it("returns null without throwing or redirecting when no session exists", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      const user = await getActionUser();

      expect(user).toBeNull();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("returns null when user is soft-deleted", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-deleted" },
        session: { id: "session-2", userId: "user-uuid-deleted" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockDeletedUser);

      const user = await getActionUser();

      expect(user).toBeNull();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("returns null when user is missing from database", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "user-uuid-missing" },
        session: { id: "session-3", userId: "user-uuid-missing" },
      } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const user = await getActionUser();

      expect(user).toBeNull();
      expect(redirect).not.toHaveBeenCalled();
    });
  });
});
