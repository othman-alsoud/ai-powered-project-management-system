import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetActionUser,
  mockGetUnreadNotificationCount,
  mockQueryUserNotifications,
  mockResolveAndMarkNotificationOpen,
  mockNotificationUpdateMany,
  mockNotificationFindFirst,
} = vi.hoisted(() => ({
  mockGetActionUser: vi.fn(),
  mockGetUnreadNotificationCount: vi.fn(),
  mockQueryUserNotifications: vi.fn(),
  mockResolveAndMarkNotificationOpen: vi.fn(),
  mockNotificationUpdateMany: vi.fn(),
  mockNotificationFindFirst: vi.fn(),
}));

vi.mock("@/features/auth/server", () => ({
  getActionUser: mockGetActionUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      updateMany: mockNotificationUpdateMany,
      findFirst: mockNotificationFindFirst,
    },
  },
}));

vi.mock("../server", () => ({
  getUnreadNotificationCount: mockGetUnreadNotificationCount,
  queryUserNotifications: mockQueryUserNotifications,
  resolveAndMarkNotificationOpen: mockResolveAndMarkNotificationOpen,
}));

import {
  getNotificationsAction,
  getUnreadCountAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
} from "../actions";
import { encodeNotificationCursor } from "../validation";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOTIF_ID = "99999999-9999-4999-8999-999999999991";

describe("notification server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActionUser.mockResolvedValue({ id: USER_ID, deletedAt: null });
    mockGetUnreadNotificationCount.mockResolvedValue(3);
    mockQueryUserNotifications.mockResolvedValue({
      items: [],
      unreadCount: 3,
      hasMore: false,
      nextCursor: null,
    });
    mockNotificationUpdateMany.mockResolvedValue({ count: 1 });
    mockNotificationFindFirst.mockResolvedValue({
      id: NOTIF_ID,
      readAt: new Date("2026-11-26T04:10:00.000Z"),
    });
    mockResolveAndMarkNotificationOpen.mockResolvedValue({
      found: true,
      result: {
        id: NOTIF_ID,
        readAt: "2026-11-26T04:10:00.000Z",
        unreadCount: 2,
        href: "/teams/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222",
        isAccessible: true,
      },
    });
  });

  describe("getUnreadCountAction", () => {
    it("rejects unauthenticated callers and uses session user.id exclusively", async () => {
      mockGetActionUser.mockResolvedValueOnce(null);
      expect(await getUnreadCountAction()).toEqual({
        success: false,
        error: "Authentication required.",
      });
      expect(mockGetUnreadNotificationCount).not.toHaveBeenCalled();

      const res = await getUnreadCountAction();
      expect(res).toEqual({ success: true, data: { unreadCount: 3 } });
      expect(mockGetUnreadNotificationCount).toHaveBeenCalledWith(USER_ID);
    });

    it("sanitizes unexpected DB errors", async () => {
      mockGetUnreadNotificationCount.mockRejectedValueOnce(
        new Error('relation "notification" connection lost'),
      );
      expect(await getUnreadCountAction()).toEqual({
        success: false,
        error: "Unable to load notifications.",
      });
    });
  });

  describe("getNotificationsAction", () => {
    it("rejects unauthenticated callers and invalid pagination cursors/limits", async () => {
      mockGetActionUser.mockResolvedValueOnce(null);
      expect(await getNotificationsAction()).toEqual({
        success: false,
        error: "Authentication required.",
      });

      const badCursor = await getNotificationsAction({ cursor: "tampered" });
      expect(badCursor.success).toBe(false);
      if (!badCursor.success) {
        expect(badCursor.fieldErrors?.cursor).toBeDefined();
      }

      const badLimit = await getNotificationsAction({ limit: 999 });
      expect(badLimit.success).toBe(false);
      if (!badLimit.success) {
        expect(badLimit.fieldErrors?.limit).toBeDefined();
      }
      expect(mockQueryUserNotifications).not.toHaveBeenCalled();
    });

    it("queries strictly by session user.id regardless of any extra input properties", async () => {
      const cursor = encodeNotificationCursor({
        createdAt: "2026-11-26T04:00:00.000Z",
        id: NOTIF_ID,
      });

      const res = await getNotificationsAction({
        limit: 10,
        filter: "unread",
        cursor,
        userId: OTHER_USER_ID,
      } as never);

      expect(res.success).toBe(true);
      expect(mockQueryUserNotifications).toHaveBeenCalledWith(USER_ID, {
        limit: 10,
        filter: "unread",
        cursor: {
          createdAt: new Date("2026-11-26T04:00:00.000Z"),
          id: NOTIF_ID,
        },
      });
    });
  });

  describe("markNotificationReadAction", () => {
    it("rejects unauthenticated callers and malformed notification IDs", async () => {
      mockGetActionUser.mockResolvedValueOnce(null);
      expect(await markNotificationReadAction({ notificationId: NOTIF_ID })).toEqual({
        success: false,
        error: "Authentication required.",
      });

      const invalid = await markNotificationReadAction({ notificationId: "bad-id" });
      expect(invalid.success).toBe(false);
      expect(mockNotificationUpdateMany).not.toHaveBeenCalled();
    });

    it("scopes update strictly by authenticated userId, handles idempotent reads, and rejects foreign notifications", async () => {
      // Concurrent / already-read idempotent case: updateMany count = 0, but record exists for USER_ID
      mockNotificationUpdateMany.mockResolvedValueOnce({ count: 0 });
      mockNotificationFindFirst.mockResolvedValueOnce({
        id: NOTIF_ID,
        readAt: new Date("2026-11-26T03:00:00.000Z"),
      });
      mockGetUnreadNotificationCount.mockResolvedValueOnce(2);

      const idempotentRes = await markNotificationReadAction({
        notificationId: NOTIF_ID,
      });
      expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
        where: { id: NOTIF_ID, userId: USER_ID, readAt: null },
        data: { readAt: expect.any(Date) },
      });
      expect(mockNotificationFindFirst).toHaveBeenCalledWith({
        where: { id: NOTIF_ID, userId: USER_ID },
        select: { id: true, readAt: true },
      });
      expect(idempotentRes).toEqual({
        success: true,
        data: {
          id: NOTIF_ID,
          readAt: "2026-11-26T03:00:00.000Z",
          unreadCount: 2,
        },
      });

      // Notification owned by another user -> updateMany count = 0 and findFirst returns null
      mockNotificationUpdateMany.mockResolvedValueOnce({ count: 0 });
      mockNotificationFindFirst.mockResolvedValueOnce(null);
      const foreignRes = await markNotificationReadAction({
        notificationId: NOTIF_ID,
      });
      expect(foreignRes).toEqual({
        success: false,
        error: "Notification not found.",
      });
    });
  });

  describe("openNotificationAction", () => {
    it("revalidates ownership and resource accessibility on click", async () => {
      mockGetActionUser.mockResolvedValueOnce(null);
      expect(await openNotificationAction({ notificationId: NOTIF_ID })).toEqual({
        success: false,
        error: "Authentication required.",
      });

      const okRes = await openNotificationAction({ notificationId: NOTIF_ID });
      expect(okRes.success).toBe(true);
      expect(mockResolveAndMarkNotificationOpen).toHaveBeenCalledWith(
        USER_ID,
        NOTIF_ID,
      );

      mockResolveAndMarkNotificationOpen.mockResolvedValueOnce({ found: false });
      expect(await openNotificationAction({ notificationId: NOTIF_ID })).toEqual({
        success: false,
        error: "Notification not found.",
      });
    });
  });

  describe("markAllNotificationsReadAction", () => {
    it("marks only the authenticated user's unread notifications and returns updated unreadCount", async () => {
      mockGetActionUser.mockResolvedValueOnce(null);
      expect(await markAllNotificationsReadAction()).toEqual({
        success: false,
        error: "Authentication required.",
      });

      mockNotificationUpdateMany.mockResolvedValueOnce({ count: 5 });
      mockGetUnreadNotificationCount.mockResolvedValueOnce(0);

      const res = await markAllNotificationsReadAction();
      expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, readAt: null },
        data: { readAt: expect.any(Date) },
      });
      expect(res).toEqual({
        success: true,
        data: { markedCount: 5, unreadCount: 0 },
      });
    });
  });
});
