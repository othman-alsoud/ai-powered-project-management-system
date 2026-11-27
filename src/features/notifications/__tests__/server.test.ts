import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockNotificationFindMany,
  mockNotificationFindFirst,
  mockNotificationCount,
  mockNotificationUpdateMany,
  mockTeamMemberFindMany,
  mockTeamMemberFindUnique,
} = vi.hoisted(() => ({
  mockNotificationFindMany: vi.fn(),
  mockNotificationFindFirst: vi.fn(),
  mockNotificationCount: vi.fn(),
  mockNotificationUpdateMany: vi.fn(),
  mockTeamMemberFindMany: vi.fn(),
  mockTeamMemberFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: mockNotificationFindMany,
      findFirst: mockNotificationFindFirst,
      count: mockNotificationCount,
      updateMany: mockNotificationUpdateMany,
    },
    teamMember: {
      findMany: mockTeamMemberFindMany,
      findUnique: mockTeamMemberFindUnique,
    },
  },
}));

import {
  DELETED_PROJECT_NOTIFICATION_MESSAGE,
  DELETED_TASK_NOTIFICATION_MESSAGE,
  DELETED_USER_DISPLAY_NAME,
  REVOKED_TEAM_NOTIFICATION_MESSAGE,
  UNAVAILABLE_NOTIFICATION_TITLE,
} from "../constants";
import {
  buildNotificationsWhereInput,
  getUnreadNotificationCount,
  queryUserNotifications,
  resolveAndMarkNotificationOpen,
} from "../server";
import { decodeNotificationCursor } from "../validation";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTOR_A_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEAM_A_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_B_ID = "22222222-2222-4222-8222-222222222222";
const TEAM_REVOKED_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_A_ID = "44444444-4444-4444-8444-444444444444";
const PROJECT_B_ID = "55555555-5555-4555-8555-555555555555";
const TASK_A_ID = "66666666-6666-4666-8666-666666666666";
const NOTIF_1_ID = "99999999-9999-4999-8999-999999999991";
const NOTIF_2_ID = "99999999-9999-4999-8999-999999999992";
const NOTIF_3_ID = "99999999-9999-4999-8999-999999999993";

function makeRawNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIF_1_ID,
    userId: USER_ID,
    actorId: ACTOR_A_ID,
    teamId: TEAM_A_ID,
    projectId: PROJECT_A_ID,
    taskId: TASK_A_ID,
    type: "task_assigned",
    title: "Task assigned",
    message: 'You were assigned to "Build API".',
    readAt: null,
    createdAt: new Date("2026-11-26T04:00:00.000Z"),
    actor: {
      id: ACTOR_A_ID,
      name: "Bob Manager",
      image: "https://example.com/bob.png",
      deletedAt: null,
    },
    project: {
      id: PROJECT_A_ID,
      name: "Core Platform",
      deletedAt: null,
    },
    task: {
      id: TASK_A_ID,
      title: "Build API",
      projectId: PROJECT_A_ID,
      deletedAt: null,
      project: {
        id: PROJECT_A_ID,
        deletedAt: null,
      },
    },
    ...overrides,
  };
}

describe("notifications server queries & sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationFindMany.mockResolvedValue([]);
    mockNotificationCount.mockResolvedValue(0);
    mockTeamMemberFindMany.mockResolvedValue([
      { teamId: TEAM_A_ID, team: { id: TEAM_A_ID, name: "Alpha Team" } },
      { teamId: TEAM_B_ID, team: { id: TEAM_B_ID, name: "Beta Team" } },
    ]);
    mockNotificationUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("scopes unread count and list queries strictly by authenticated userId across all teams", async () => {
    mockNotificationCount.mockResolvedValueOnce(4);
    const unread = await getUnreadNotificationCount(USER_ID);
    expect(unread).toBe(4);
    expect(mockNotificationCount).toHaveBeenCalledWith({
      where: { userId: USER_ID, readAt: null },
    });

    const whereAll = buildNotificationsWhereInput(USER_ID, {
      limit: 15,
      filter: "all",
    });
    expect(whereAll).toEqual({ userId: USER_ID });

    const cursorDate = new Date("2026-11-26T04:00:00.000Z");
    const whereUnreadCursor = buildNotificationsWhereInput(USER_ID, {
      limit: 15,
      filter: "unread",
      cursor: { createdAt: cursorDate, id: NOTIF_1_ID },
    });
    expect(whereUnreadCursor).toEqual({
      userId: USER_ID,
      readAt: null,
      OR: [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: NOTIF_1_ID } },
      ],
    });
  });

  it("returns account-wide notifications across multiple teams and resolves moved task parent projects", async () => {
    const teamARow = makeRawNotification({
      id: NOTIF_1_ID,
      teamId: TEAM_A_ID,
      projectId: PROJECT_A_ID,
      task: {
        id: TASK_A_ID,
        title: "Moved Task",
        projectId: PROJECT_B_ID, // Task moved to another active project
        deletedAt: null,
        project: { id: PROJECT_B_ID, deletedAt: null },
      },
    });
    const teamBRow = makeRawNotification({
      id: NOTIF_2_ID,
      teamId: TEAM_B_ID,
      projectId: PROJECT_B_ID,
      taskId: null,
      task: null,
      type: "project_completed",
      title: "Project completed",
      message: 'Project "Beta Rollout" was marked as Completed.',
      readAt: new Date("2026-11-26T04:05:00.000Z"),
      project: { id: PROJECT_B_ID, name: "Beta Rollout", deletedAt: null },
    });

    mockNotificationFindMany.mockResolvedValueOnce([teamARow, teamBRow]);
    mockNotificationCount.mockResolvedValueOnce(1);

    const page = await queryUserNotifications(USER_ID, {
      limit: 15,
      filter: "all",
    });

    expect(page.unreadCount).toBe(1);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(2);

    expect(page.items[0]).toMatchObject({
      id: NOTIF_1_ID,
      isRead: false,
      isAccessible: true,
      team: { id: TEAM_A_ID, name: "Alpha Team" },
      href: `/teams/${TEAM_A_ID}/projects/${PROJECT_B_ID}`,
      actor: {
        name: "Bob Manager",
        image: "https://example.com/bob.png",
        isDeleted: false,
      },
    });

    expect(page.items[1]).toMatchObject({
      id: NOTIF_2_ID,
      isRead: true,
      isAccessible: true,
      team: { id: TEAM_B_ID, name: "Beta Team" },
      href: `/teams/${TEAM_B_ID}/projects/${PROJECT_B_ID}`,
    });
  });

  it("sanitizes notifications from revoked/deleted teams, deleted projects, deleted tasks, and deleted actors", async () => {
    const revokedTeamNotif = makeRawNotification({
      id: NOTIF_1_ID,
      teamId: TEAM_REVOKED_ID,
      title: "Secret title",
      message: 'You were assigned to "Secret Project Task".',
      actor: {
        id: ACTOR_A_ID,
        name: "Secret Colleague",
        image: "https://example.com/secret.png",
        deletedAt: null,
      },
    });
    const deletedProjectNotif = makeRawNotification({
      id: NOTIF_2_ID,
      teamId: TEAM_A_ID,
      project: { id: PROJECT_A_ID, name: "Secret Deleted Project", deletedAt: new Date() },
      task: {
        id: TASK_A_ID,
        title: "Hidden Task",
        projectId: PROJECT_A_ID,
        deletedAt: null,
        project: { id: PROJECT_A_ID, deletedAt: new Date() },
      },
      actor: {
        id: ACTOR_A_ID,
        name: "Deleted User",
        image: "https://example.com/stale.png",
        deletedAt: new Date(),
      },
    });
    const deletedTaskNotif = makeRawNotification({
      id: NOTIF_3_ID,
      teamId: TEAM_A_ID,
      message: 'You were assigned to "Confidential Deleted Task".',
      task: {
        id: TASK_A_ID,
        title: "Confidential Deleted Task",
        projectId: PROJECT_A_ID,
        deletedAt: new Date(),
        project: { id: PROJECT_A_ID, deletedAt: null },
      },
    });

    mockNotificationFindMany.mockResolvedValueOnce([
      revokedTeamNotif,
      deletedProjectNotif,
      deletedTaskNotif,
    ]);
    mockNotificationCount.mockResolvedValueOnce(3);

    const page = await queryUserNotifications(USER_ID, {
      limit: 15,
      filter: "all",
    });

    // 1. Revoked team: strips team, actor, href, and raw message
    expect(page.items[0]).toMatchObject({
      id: NOTIF_1_ID,
      title: UNAVAILABLE_NOTIFICATION_TITLE,
      message: REVOKED_TEAM_NOTIFICATION_MESSAGE,
      team: null,
      href: null,
      isAccessible: false,
      actor: { name: "Unavailable", image: null, isDeleted: false },
    });
    expect(JSON.stringify(page.items[0])).not.toContain("Secret");

    // 2. Deleted project + anonymized actor: strips stale image, deleted project name, and href
    expect(page.items[1]).toMatchObject({
      id: NOTIF_2_ID,
      title: UNAVAILABLE_NOTIFICATION_TITLE,
      message: DELETED_PROJECT_NOTIFICATION_MESSAGE,
      team: { id: TEAM_A_ID, name: "Alpha Team" },
      href: null,
      isAccessible: false,
      actor: {
        name: DELETED_USER_DISPLAY_NAME,
        image: null,
        isDeleted: true,
      },
    });
    expect(JSON.stringify(page.items[1])).not.toContain("Secret Deleted Project");
    expect(JSON.stringify(page.items[1])).not.toContain("stale.png");

    // 3. Deleted task: strips deleted task title and href
    expect(page.items[2]).toMatchObject({
      id: NOTIF_3_ID,
      title: UNAVAILABLE_NOTIFICATION_TITLE,
      message: DELETED_TASK_NOTIFICATION_MESSAGE,
      href: null,
      isAccessible: false,
    });
    expect(JSON.stringify(page.items[2])).not.toContain("Confidential Deleted Task");
  });

  it("handles keyset pagination (limit + 1) and equal timestamps cleanly", async () => {
    const sameTs = new Date("2026-11-26T04:00:00.000Z");
    const rows = [
      makeRawNotification({ id: NOTIF_3_ID, createdAt: sameTs }),
      makeRawNotification({ id: NOTIF_2_ID, createdAt: sameTs }),
      makeRawNotification({ id: NOTIF_1_ID, createdAt: sameTs }),
    ];
    mockNotificationFindMany.mockResolvedValueOnce(rows);
    mockNotificationCount.mockResolvedValueOnce(3);

    const page = await queryUserNotifications(USER_ID, {
      limit: 2,
      filter: "all",
    });

    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 3,
      }),
    );
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeNotificationCursor(page.nextCursor!)).toEqual({
      createdAt: sameTs,
      id: NOTIF_2_ID,
    });
  });

  it("resolveAndMarkNotificationOpen revalidates access live and refuses navigation if revoked/deleted", async () => {
    mockNotificationFindFirst.mockResolvedValueOnce(makeRawNotification());
    mockTeamMemberFindUnique.mockResolvedValueOnce({
      teamId: TEAM_A_ID,
      userId: USER_ID,
      team: { id: TEAM_A_ID, name: "Alpha Team", deletedAt: null },
    });
    mockNotificationCount.mockResolvedValueOnce(0);

    const valid = await resolveAndMarkNotificationOpen(USER_ID, NOTIF_1_ID);
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: { id: NOTIF_1_ID, userId: USER_ID, readAt: null },
      data: { readAt: expect.any(Date) },
    });
    expect(valid).toMatchObject({
      found: true,
      result: {
        id: NOTIF_1_ID,
        href: `/teams/${TEAM_A_ID}/projects/${PROJECT_A_ID}`,
        isAccessible: true,
        unreadCount: 0,
      },
    });

    // Membership revoked between list poll and click
    mockNotificationFindFirst.mockResolvedValueOnce(makeRawNotification());
    mockTeamMemberFindUnique.mockResolvedValueOnce(null);
    mockNotificationCount.mockResolvedValueOnce(0);

    const revoked = await resolveAndMarkNotificationOpen(USER_ID, NOTIF_1_ID);
    expect(revoked).toMatchObject({
      found: true,
      result: {
        id: NOTIF_1_ID,
        href: null,
        isAccessible: false,
        unavailableReason: REVOKED_TEAM_NOTIFICATION_MESSAGE,
        unreadCount: 0,
      },
    });

    // Notification owned by another user -> not found
    mockNotificationFindFirst.mockResolvedValueOnce(null);
    const foreign = await resolveAndMarkNotificationOpen(USER_ID, NOTIF_2_ID);
    expect(foreign).toEqual({ found: false });
  });
});
