import React from "react";
import type { ActionResult } from "@/features/teams/actions";
import type { ActivityFeedPage } from "@/features/activity/types";
import type { CommentItemSummary, CommentThreadResult } from "@/features/comments/server";
import type { NotificationsPageDTO, OpenNotificationResult } from "@/features/notifications/types";
import type { TeamMemberSummary } from "@/features/teams/server";

export function LinkMock({
  href,
  children,
  ...rest
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string };
  prefetch?: boolean;
}) {
  const resolvedHref =
    typeof href === "string" ? href : (href?.pathname ?? "#");
  return (
    <a href={resolvedHref} {...rest}>
      {children}
    </a>
  );
}

export default LinkMock;

export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => Promise.resolve(),
  };
}

export function usePathname(): string {
  if (typeof window !== "undefined") {
    const view = new URLSearchParams(window.location.search).get("view") ?? "dashboard";
    if (view === "dashboard") return "/teams/team-1";
    if (view === "account") return "/account";
    if (view === "onboarding") return "/teams";
    return `/teams/team-1/${view}`;
  }
  return "/teams/team-1";
}

export function useSearchParams(): URLSearchParams {
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams();
}

export function useParams() {
  return { teamId: "team-1" };
}

export const authClient = {
  signOut: async () => ({ error: null }),
  signIn: { email: async () => ({ error: null }), social: async () => ({ error: null }) },
  signUp: { email: async () => ({ error: null, data: { session: null } }) },
  requestPasswordReset: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  verifyEmail: async () => ({ error: null }),
  sendVerificationEmail: async () => ({ error: null }),
};

export const MOCK_MEMBERS: TeamMemberSummary[] = [
  {
    userId: "user-1",
    name: "Alice Owner",
    email: "alice@example.com",
    image: null,
    role: "OWNER",
    joinedAt: new Date("2026-10-01T10:00:00Z"),
  },
  {
    userId: "user-2",
    name: "Bob Manager",
    email: "bob@example.com",
    image: null,
    role: "MANAGER",
    joinedAt: new Date("2026-10-05T10:00:00Z"),
  },
  {
    userId: "user-3",
    name: "Charlie Member",
    email: "charlie@example.com",
    image: null,
    role: "MEMBER",
    joinedAt: new Date("2026-10-12T10:00:00Z"),
  },
];

export const MOCK_COMMENTS: CommentItemSummary[] = [
  {
    id: "comment-1",
    teamId: "team-1",
    taskId: "task-1",
    userId: "user-1",
    content: "Verified WCAG contrast ratios across light and dark themes.",
    createdAt: "2026-11-26T10:00:00.000Z",
    updatedAt: "2026-11-26T10:00:00.000Z",
    isEdited: false,
    author: { id: "user-1", name: "Alice Owner" },
  },
  {
    id: "comment-2",
    teamId: "team-1",
    taskId: "task-1",
    userId: "user-2",
    content: "Ready for keyboard navigation verification.",
    createdAt: "2026-11-26T11:30:00.000Z",
    updatedAt: "2026-11-26T11:35:00.000Z",
    isEdited: true,
    author: { id: "user-2", name: "Bob Manager" },
  },
];

// Teams actions
export async function createTeamAction(): Promise<ActionResult<{ teamId: string }>> {
  return { success: true, data: { teamId: "team-new" } };
}
export async function switchTeamAction(): Promise<ActionResult<{ teamId: string }>> {
  return { success: true, data: { teamId: "team-2" } };
}
export async function addMemberAction(): Promise<ActionResult<{ userId: string }>> {
  return { success: true, data: { userId: "user-4" } };
}
export async function updateMemberRoleAction(): Promise<ActionResult<{ updated: boolean }>> {
  return { success: true, data: { updated: true } };
}
export async function removeMemberAction(): Promise<ActionResult<{ removed: boolean }>> {
  return { success: true, data: { removed: true } };
}
export async function transferOwnershipAction(): Promise<ActionResult<{ transferred: boolean }>> {
  return { success: true, data: { transferred: true } };
}
export async function getTeamMembersAction(): Promise<ActionResult<TeamMemberSummary[]>> {
  return { success: true, data: MOCK_MEMBERS };
}
export async function resolveActiveTeamContextAction() {
  return {
    status: "VALID" as const,
    userId: "user-1",
    activeTeamId: "team-1",
    role: "OWNER" as const,
  };
}

// Projects actions
export async function createProjectAction(): Promise<ActionResult<{ projectId: string }>> {
  return { success: true, data: { projectId: "project-new" } };
}
export async function updateProjectAction(): Promise<ActionResult<{ projectId: string }>> {
  return { success: true, data: { projectId: "project-1" } };
}
export async function updateProjectStatusAction(): Promise<ActionResult<{ projectId: string }>> {
  return { success: true, data: { projectId: "project-1" } };
}
export async function deleteProjectAction(): Promise<ActionResult<{ deleted: boolean }>> {
  return { success: true, data: { deleted: true } };
}

// Tasks actions
export async function createTaskAction(): Promise<ActionResult<{ taskId: string }>> {
  return { success: true, data: { taskId: "task-new" } };
}
export async function updateTaskAction(): Promise<ActionResult<{ noOp: boolean }>> {
  return { success: true, data: { noOp: false } };
}
export async function updateTaskStatusAction(): Promise<ActionResult<{ noOp: boolean }>> {
  return { success: true, data: { noOp: false } };
}
export async function deleteTaskAction(): Promise<ActionResult<{ deleted: boolean }>> {
  return { success: true, data: { deleted: true } };
}

// Comments actions
export async function getTaskCommentsAction(): Promise<ActionResult<CommentThreadResult>> {
  return {
    success: true,
    data: { comments: MOCK_COMMENTS, totalCount: MOCK_COMMENTS.length, isCapped: false, limit: 200 },
  };
}
export const getCommentsAction = getTaskCommentsAction;
export async function createCommentAction(): Promise<ActionResult<{ comment: CommentItemSummary }>> {
  return { success: true, data: { comment: MOCK_COMMENTS[0]! } };
}
export async function updateCommentAction(): Promise<ActionResult<{ noOp: boolean }>> {
  return { success: true, data: { noOp: false } };
}
export async function deleteCommentAction(): Promise<ActionResult<{ deleted: boolean }>> {
  return { success: true, data: { deleted: true } };
}

// Activity actions
export async function getTeamActivityAction(): Promise<ActionResult<ActivityFeedPage>> {
  return { success: true, data: { items: [], nextCursor: null, hasMore: false } };
}

// Notifications actions
export async function getNotificationsAction(params?: {
  filter?: "all" | "unread";
}): Promise<ActionResult<NotificationsPageDTO>> {
  const allItems = [
    {
      id: "notif-1",
      type: "task_assigned",
      title: "Assigned to Audit keyboard focus traps",
      message: "Alice Owner assigned you a task in Core Platform.",
      isRead: false,
      readAt: null,
      createdAt: "2026-11-26T12:00:00.000Z",
      actor: { name: "Alice Owner", image: null, isDeleted: false },
      team: { id: "team-1", name: "Core Engineering" },
      href: "/teams/team-1/tasks",
      isAccessible: true,
    },
    {
      id: "notif-2",
      type: "task_status_changed",
      title: "Status updated to In Review",
      message: "Bob Manager moved Audit color contrast to In Review.",
      isRead: true,
      readAt: "2026-11-26T12:05:00.000Z",
      createdAt: "2026-11-26T11:00:00.000Z",
      actor: { name: "Bob Manager", image: null, isDeleted: false },
      team: { id: "team-1", name: "Core Engineering" },
      href: "/teams/team-1/tasks",
      isAccessible: true,
    },
  ];
  const filtered = params?.filter === "unread" ? allItems.filter((n) => !n.isRead) : allItems;
  return {
    success: true,
    data: { items: filtered, unreadCount: 1, hasMore: false, nextCursor: null },
  };
}
export async function getUnreadCountAction(): Promise<ActionResult<{ unreadCount: number }>> {
  return { success: true, data: { unreadCount: 1 } };
}
export async function markNotificationReadAction(): Promise<
  ActionResult<{ readAt: string; unreadCount: number }>
> {
  return { success: true, data: { readAt: "2026-11-26T12:10:00.000Z", unreadCount: 0 } };
}
export async function markAllNotificationsReadAction(): Promise<ActionResult<{ unreadCount: number }>> {
  return { success: true, data: { unreadCount: 0 } };
}
export async function openNotificationAction(): Promise<ActionResult<OpenNotificationResult>> {
  return {
    success: true,
    data: {
      id: "notif-1",
      readAt: "2026-11-26T12:10:00.000Z",
      unreadCount: 0,
      href: "/teams/team-1/tasks",
      isAccessible: true,
    },
  };
}

// Account actions
export async function deleteAccountAction(): Promise<ActionResult<{ anonymized: boolean }>> {
  return { success: true, data: { anonymized: true } };
}
