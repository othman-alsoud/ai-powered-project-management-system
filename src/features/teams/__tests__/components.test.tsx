import { describe, it, expect, vi } from "vitest";
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
  usePathname: () => "/teams/team-123/activity",
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

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock("../components/team-context-sync", () => ({
  TeamContextSync: () => null,
}));

vi.mock("../components/team-switcher", () => ({
  TeamSwitcher: () => React.createElement("div", null, "TeamSwitcher"),
}));

import { WorkspaceSidebar } from "../components/sidebar";

import { TeamMembersList } from "../components/team-members-list";
import { AddMemberDialog } from "../components/add-member-dialog";
import { TransferOwnershipDialog } from "../components/transfer-ownership-dialog";
import type { TeamMemberSummary } from "../server";

const mockMembers: TeamMemberSummary[] = [
  {
    userId: "user-1",
    name: "Alice Owner",
    email: "alice@example.com",
    image: null,
    role: "OWNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    userId: "user-2",
    name: "Bob Manager",
    email: "bob@example.com",
    image: null,
    role: "MANAGER",
    joinedAt: new Date("2026-01-02T00:00:00Z"),
  },
  {
    userId: "user-3",
    name: "Charlie Member",
    email: "charlie@example.com",
    image: null,
    role: "MEMBER",
    joinedAt: new Date("2026-01-03T00:00:00Z"),
  },
];

describe("TeamMembersList UI Component", () => {
  it("renders member rows with names, emails, and roles", () => {
    const html = renderToString(
      <TeamMembersList
        teamId="team-123"
        members={mockMembers}
        currentUserRole="OWNER"
        currentUserId="user-1"
      />
    );

    expect(html).toContain("Alice Owner");
    expect(html).toContain("alice@example.com");
    expect(html).toContain("Bob Manager");
    expect(html).toContain("bob@example.com");
    expect(html).toContain("Charlie Member");
    expect(html).toContain("charlie@example.com");
    expect(html).toContain("Workspace Owner");
    expect(html).toContain("(You)");
  });

  it("shows role edit dropdown and Remove button for other members when caller is OWNER", () => {
    const html = renderToString(
      <TeamMembersList
        teamId="team-123"
        members={mockMembers}
        currentUserRole="OWNER"
        currentUserId="user-1"
      />
    );

    expect(html).toContain("Actions");
    expect(html).toContain("Change role for Bob Manager");
    expect(html).toContain("Change role for Charlie Member");
    expect(html).toContain("Remove");
  });

  it("hides Actions column and role dropdowns when caller is MEMBER", () => {
    const html = renderToString(
      <TeamMembersList
        teamId="team-123"
        members={mockMembers}
        currentUserRole="MEMBER"
        currentUserId="user-3"
      />
    );

    expect(html).not.toContain("Actions");
    expect(html).not.toContain("Change role for");
    expect(html).not.toContain("Remove");
  });

  it("hides Actions column and role dropdowns when caller is MANAGER (OWNER-only approved rule)", () => {
    const html = renderToString(
      <TeamMembersList
        teamId="team-123"
        members={mockMembers}
        currentUserRole="MANAGER"
        currentUserId="user-2"
      />
    );

    expect(html).not.toContain("Actions");
    expect(html).not.toContain("Change role for");
    expect(html).not.toContain("Remove");
  });
});

describe("AddMemberDialog UI Component", () => {
  it("renders nothing when closed (open = false)", () => {
    const html = renderToString(
      <AddMemberDialog
        open={false}
        onOpenChange={() => {}}
        teamId="team-123"
      />
    );

    expect(html).toBe("");
  });

  it("renders title, email input, role selector, and action buttons when open", () => {
    const html = renderToString(
      <AddMemberDialog
        open={true}
        onOpenChange={() => {}}
        teamId="team-123"
      />
    );

    expect(html).toContain("Add Team Member");
    expect(html).toContain("Email Address");
    expect(html).toContain("Role");
    expect(html).toContain("Member (Standard access)");
    expect(html).toContain("Manager (Can manage projects &amp; tasks)");
    expect(html).toContain("Cancel");
    expect(html).toContain("Add Member");
  });
});

describe("TransferOwnershipDialog UI Component", () => {
  it("renders nothing when closed (open = false)", () => {
    const html = renderToString(
      <TransferOwnershipDialog
        open={false}
        onOpenChange={() => {}}
        teamId="team-123"
        members={mockMembers}
        currentUserId="user-1"
      />
    );

    expect(html).toBe("");
  });

  it("renders warning banner, eligible members in select, and confirmation checkbox when open", () => {
    const html = renderToString(
      <TransferOwnershipDialog
        open={true}
        onOpenChange={() => {}}
        teamId="team-123"
        members={mockMembers}
        currentUserId="user-1"
      />
    );

    expect(html).toContain("Transfer Ownership");
    expect(html).toContain("Irreversible Action");
    expect(html).toContain("you will become a");
    expect(html).toContain("Manager");
    // Eligible members are Bob and Charlie (Alice is current owner, so excluded)
    expect(html).toContain("Bob Manager");
    expect(html).toContain("bob@example.com");
    expect(html).toContain("Charlie Member");
    expect(html).toContain("charlie@example.com");
    expect(html).not.toContain("Alice Owner");
    expect(html).toContain("Confirm Transfer");
    expect(html).toContain("I understand that I am relinquishing workspace ownership");
  });

  it("renders notice when no other members exist to transfer ownership to", () => {
    const html = renderToString(
      <TransferOwnershipDialog
        open={true}
        onOpenChange={() => {}}
        teamId="team-123"
        members={[mockMembers[0]!]} // Only Alice (the owner)
        currentUserId="user-1"
      />
    );

    expect(html).toContain("There are no other active members in this team.");
    expect(html).not.toContain("Confirm Transfer");
  });
});

describe("WorkspaceSidebar UI Component", () => {
  it("renders the Activity navigation link scoped to the active team", () => {
    const html = renderToString(
      <WorkspaceSidebar
        currentTeam={{ id: "team-123", name: "Core Engineering" }}
        currentRole="MEMBER"
        userTeams={[
          {
            id: "team-123",
            name: "Core Engineering",
            description: null,
            role: "MEMBER",
            joinedAt: new Date("2026-01-01T00:00:00Z"),
          },
        ]}
        currentUser={{
          id: "user-3",
          name: "Charlie Member",
          email: "charlie@example.com",
          image: null,
        }}
      />,
    );

    expect(html).toContain('href="/teams/team-123/activity"');
    expect(html).toContain("Activity");
    expect(html).toContain("Notifications, 0 unread");
  });

  it("renders NotificationBell badge with 9+ cap across desktop footer and mobile header when unread count >= 10", () => {
    const html = renderToString(
      <WorkspaceSidebar
        currentTeam={{ id: "team-123", name: "Core Engineering" }}
        currentRole="MEMBER"
        initialUnreadNotificationsCount={12}
        userTeams={[
          {
            id: "team-123",
            name: "Core Engineering",
            description: null,
            role: "MEMBER",
            joinedAt: new Date("2026-01-01T00:00:00Z"),
          },
        ]}
        currentUser={{
          id: "user-3",
          name: "Charlie Member",
          email: "charlie@example.com",
          image: null,
        }}
      />,
    );

    expect(html).toContain("Notifications, 12 unread");
    expect(html).toContain("9+");
  });

  it("anchors bottom Account and Notifications controls with a min-h-0 scrollable nav and full-height desktop aside", () => {
    const html = renderToString(
      <WorkspaceSidebar
        currentTeam={{ id: "team-123", name: "Core Engineering" }}
        currentRole="OWNER"
        userTeams={[
          {
            id: "team-123",
            name: "Core Engineering",
            description: null,
            role: "OWNER",
            joinedAt: new Date("2026-01-01T00:00:00Z"),
          },
        ]}
        currentUser={{
          id: "user-1",
          name: "Alice Owner",
          email: "alice@example.com",
          image: null,
        }}
      />,
    );

    // Desktop aside keeps full height and never shrinks
    expect(html).toContain("md:h-full md:min-h-0 md:shrink-0");
    // Nav region independently scrollable inside flex column
    expect(html).toMatch(/<nav[^>]*class="[^"]*min-h-0[^"]*flex-1[^"]*overflow-y-auto[^"]*"/);
    // Bottom section does not shrink when nav or page scrolls
    expect(html).toMatch(/class="shrink-0 border-t border-slate-200/);
    // Mobile header and drawer trigger remain md:hidden
    expect(html).toContain("md:hidden");
  });
});
