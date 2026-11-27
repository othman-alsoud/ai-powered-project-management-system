import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("@/features/auth/server", () => ({
  requireAuthPage: vi.fn(),
}));

vi.mock("@/features/auth/account-server", () => ({
  getAccountDeletionEligibility: vi.fn(),
}));

import { requireAuthPage } from "@/features/auth/server";
import { getAccountDeletionEligibility } from "@/features/auth/account-server";
import AccountPage from "../page";
import {
  DeleteAccountSection,
  DeleteAccountDialog,
} from "@/features/auth/components/delete-account-section";

const mockUser = {
  id: "user-123",
  name: "Alice Contributor",
  email: "alice@example.com",
  emailVerified: true,
  image: null,
  lastActiveTeamId: "team-1",
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("AccountPage (Server Component) & DeleteAccount UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated callers via requireAuthPage('/sign-in')", async () => {
    vi.mocked(requireAuthPage).mockRejectedValueOnce(new Error("NEXT_REDIRECT: /sign-in"));

    await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT: /sign-in");
    expect(requireAuthPage).toHaveBeenCalledWith("/sign-in");
    expect(getAccountDeletionEligibility).not.toHaveBeenCalled();
  });

  it("renders account summary and eligibility info when authenticated", async () => {
    vi.mocked(requireAuthPage).mockResolvedValueOnce(mockUser);
    vi.mocked(getAccountDeletionEligibility).mockResolvedValueOnce({
      eligible: true,
      ownedTeams: [],
      activeAssignedTaskCount: 0,
      hasPasswordAccount: true,
      authProviders: ["Email & Password"],
    });

    const jsx = await AccountPage();
    const html = renderToString(jsx as React.ReactElement);

    expect(requireAuthPage).toHaveBeenCalledWith("/sign-in");
    expect(getAccountDeletionEligibility).toHaveBeenCalledWith("user-123");
    expect(html).toContain("Account Settings");
    expect(html).toContain('id="main-content"');
    expect(html).toMatch(/<h2[^>]*>Profile Summary<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>Danger Zone<\/h2>/);
    expect(html).toContain("Alice Contributor");
    expect(html).toContain("alice@example.com");
    expect(html).toContain("Email &amp; Password");
    expect(html).toContain("Danger Zone");
    expect(html).toContain("Delete Account");
  });

  it("renders owned-team links and solo-owner guidance when ineligible due to owned teams", () => {
    const html = renderToString(
      <DeleteAccountSection
        userId="user-123"
        eligibility={{
          eligible: false,
          ownedTeams: [
            { id: "team-solo", name: "Solo Lab", deletedAt: null, memberCount: 1 },
            { id: "team-shared", name: "Core Eng", deletedAt: null, memberCount: 4 },
          ],
          activeAssignedTaskCount: 2,
          hasPasswordAccount: true,
          authProviders: ["Email & Password"],
        }}
      />
    );

    expect(html).toContain("Solo Lab");
    expect(html).toContain("/teams/team-solo/settings");
    expect(html).toContain("Add another member before transferring ownership");
    expect(html).toContain("Core Eng");
    expect(html).toContain("/teams/team-shared/settings");
    expect(html).toContain("Active Assigned Tasks");
    expect(html).toContain("Reassign or complete them before deleting");
    expect(html).toContain("disabled");
  });

  it("renders password input in DeleteAccountDialog only when hasPasswordAccount is true", () => {
    const credentialHtml = renderToString(
      <DeleteAccountDialog
        open={true}
        onOpenChange={() => {}}
        userId="user-123"
        hasPasswordAccount={true}
      />
    );

    expect(credentialHtml).toContain('role="dialog"');
    expect(credentialHtml).toContain('aria-modal="true"');
    expect(credentialHtml).toContain("Current Password");
    expect(credentialHtml).toContain('type="password"');
    expect(credentialHtml).toContain("DELETE");
    expect(credentialHtml).toContain("Cancel");
    expect(credentialHtml).toContain("Delete My Account");

    const oauthHtml = renderToString(
      <DeleteAccountDialog
        open={true}
        onOpenChange={() => {}}
        userId="user-123"
        hasPasswordAccount={false}
      />
    );

    expect(oauthHtml).toContain('role="dialog"');
    expect(oauthHtml).not.toContain("Current Password");
    expect(oauthHtml).not.toContain('type="password"');
    expect(oauthHtml).toContain("DELETE");
  });

  it("renders nothing when DeleteAccountDialog is closed", () => {
    const html = renderToString(
      <DeleteAccountDialog
        open={false}
        onOpenChange={() => {}}
        userId="user-123"
        hasPasswordAccount={true}
      />
    );

    expect(html).toBe("");
  });
});
