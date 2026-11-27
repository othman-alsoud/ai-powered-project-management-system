import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("../actions", () => ({
  getNotificationsAction: vi.fn(),
  getUnreadCountAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
  markNotificationReadAction: vi.fn(),
  openNotificationAction: vi.fn(),
}));

import {
  formatNotificationRelativeTime,
  formatNotificationTimestampUtc,
  formatUnreadBadgeCount,
} from "../formatters";
import {
  NotificationBellTrigger,
  NotificationPopover,
  executeNotificationRequest,
  markAllReadLocally,
  markItemReadLocally,
  mergeNotificationItems,
  shouldPollNotifications,
} from "../components/notification-bell";
import type { NotificationItemDTO } from "../types";

const NOTIF_A_ID = "99999999-9999-4999-8999-999999999991";
const NOTIF_B_ID = "99999999-9999-4999-8999-999999999992";
const TEAM_A_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_B_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_A_ID = "44444444-4444-4444-8444-444444444444";

const unreadTeamANotif: NotificationItemDTO = {
  id: NOTIF_A_ID,
  type: "task_assigned",
  title: "Task assigned",
  message: 'You were assigned to "Implement auth".',
  isRead: false,
  readAt: null,
  createdAt: "2026-11-26T04:00:00.000Z",
  actor: { name: "Alice Owner", image: null, isDeleted: false },
  team: { id: TEAM_A_ID, name: "Alpha Team" },
  href: `/teams/${TEAM_A_ID}/projects/${PROJECT_A_ID}`,
  isAccessible: true,
};

const inaccessibleDeletedActorNotif: NotificationItemDTO = {
  id: NOTIF_B_ID,
  type: "project_cancelled",
  title: "Notification unavailable",
  message: "This notification is from a workspace you no longer have access to.",
  isRead: false,
  readAt: null,
  createdAt: "2026-11-26T03:00:00.000Z",
  actor: { name: "Deleted User", image: null, isDeleted: true },
  team: null,
  href: null,
  isAccessible: false,
};

describe("notification formatters & bell UI", () => {
  it("formats unread badges (0 hidden, 1-9 exact, 10+ -> 9+) and hydration-safe UTC/relative timestamps", () => {
    expect(formatUnreadBadgeCount(0)).toBeNull();
    expect(formatUnreadBadgeCount(-1)).toBeNull();
    expect(formatUnreadBadgeCount(1)).toBe("1");
    expect(formatUnreadBadgeCount(9)).toBe("9");
    expect(formatUnreadBadgeCount(10)).toBe("9+");
    expect(formatUnreadBadgeCount(42)).toBe("9+");

    const iso = "2026-11-26T04:00:00.000Z";
    expect(formatNotificationTimestampUtc(iso)).toContain("UTC");

    const nowMs = new Date("2026-11-26T04:05:00.000Z").getTime();
    expect(formatNotificationRelativeTime(iso, nowMs)).toBe("5m ago");
    expect(
      formatNotificationRelativeTime("2026-11-26T04:04:40.000Z", nowMs),
    ).toBe("Just now");
    expect(
      formatNotificationRelativeTime("2026-11-26T02:00:00.000Z", nowMs),
    ).toBe("2h ago");
    expect(
      formatNotificationRelativeTime("2026-11-24T04:00:00.000Z", nowMs),
    ).toBe("2d ago");
  });

  it("renders NotificationBellTrigger with unread badge and accessible attributes", () => {
    const htmlWithCount = renderToString(
      <NotificationBellTrigger
        unreadCount={12}
        isOpen={true}
        popoverId="notif-popover"
        variant="desktop-expanded"
        onClick={() => {}}
      />,
    );
    expect(htmlWithCount).toContain("9+");
    expect(htmlWithCount).toContain('aria-expanded="true"');
    expect(htmlWithCount).toContain('aria-controls="notif-popover"');
    expect(htmlWithCount).toContain("Notifications, 12 unread");

    const htmlZero = renderToString(
      <NotificationBellTrigger
        unreadCount={0}
        isOpen={false}
        popoverId="notif-popover"
        variant="mobile"
        onClick={() => {}}
      />,
    );
    expect(htmlZero).toContain("Notifications, 0 unread");
    expect(htmlZero).not.toContain("9+");
  });

  it("renders NotificationPopover with All/Unread tabs, Mark all as read, cross-team badges, sanitized unavailable state, and Load more", () => {
    const html = renderToString(
      <NotificationPopover
        id="notif-popover"
        items={[unreadTeamANotif, inaccessibleDeletedActorNotif]}
        unreadCount={2}
        filter="all"
        hasMore={true}
        isLoading={false}
        isLoadingMore={false}
        isMarkingAll={false}
        pendingItemIds={new Set()}
        error={null}
        unavailableNotice={null}
        placement="desktop-expanded"
        onClose={() => {}}
        onFilterChange={() => {}}
        onMarkAllRead={() => {}}
        onMarkRead={() => {}}
        onOpenItem={() => {}}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Notifications");
    expect(html).toContain("Mark all as read");
    expect(html).toContain("All");
    expect(html).toContain("Unread");
    expect(html).toContain("Alpha Team");
    expect(html).toContain("Alice Owner");
    expect(html).toContain("Implement auth");
    expect(html).toContain("Notification unavailable");
    expect(html).toContain("Deleted User");
    expect(html).toContain("Load more");
    expect(html).toContain("Mark as read");
    expect(TEAM_B_ID).toBeDefined();
  });

  it("renders empty and error retry states cleanly", () => {
    const emptyUnreadHtml = renderToString(
      <NotificationPopover
        id="notif-popover"
        items={[]}
        unreadCount={0}
        filter="unread"
        hasMore={false}
        isLoading={false}
        isLoadingMore={false}
        isMarkingAll={false}
        pendingItemIds={new Set()}
        error={null}
        unavailableNotice="This task is no longer available."
        placement="mobile"
        onClose={() => {}}
        onFilterChange={() => {}}
        onMarkAllRead={() => {}}
        onMarkRead={() => {}}
        onOpenItem={() => {}}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(emptyUnreadHtml).toContain("You&#x27;re all caught up");
    expect(emptyUnreadHtml).toContain("This task is no longer available.");

    const errorHtml = renderToString(
      <NotificationPopover
        id="notif-popover"
        items={[]}
        unreadCount={0}
        filter="all"
        hasMore={false}
        isLoading={false}
        isLoadingMore={false}
        isMarkingAll={false}
        pendingItemIds={new Set()}
        error="Unable to load notifications."
        unavailableNotice={null}
        placement="desktop-collapsed"
        onClose={() => {}}
        onFilterChange={() => {}}
        onMarkAllRead={() => {}}
        onMarkRead={() => {}}
        onOpenItem={() => {}}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(errorHtml).toContain("Unable to load notifications.");
    expect(errorHtml).toContain("Retry");
  });

  it("supports deduplicated merging, optimistic read updates, visibility-gated polling, and stale-response cancellation", async () => {
    const merged = mergeNotificationItems(
      [unreadTeamANotif],
      [unreadTeamANotif, inaccessibleDeletedActorNotif],
    );
    expect(merged.map((i) => i.id)).toEqual([NOTIF_A_ID, NOTIF_B_ID]);

    const readUpdated = markItemReadLocally(merged, NOTIF_A_ID, "2026-11-26T04:10:00.000Z");
    expect(readUpdated[0]?.isRead).toBe(true);
    expect(readUpdated[1]?.isRead).toBe(false);

    const allRead = markAllReadLocally(merged, "2026-11-26T04:10:00.000Z");
    expect(allRead.every((i) => i.isRead)).toBe(true);

    expect(shouldPollNotifications("visible")).toBe(true);
    expect(shouldPollNotifications("hidden")).toBe(false);

    const seqRef = { current: 1 };
    const onSuccess = vi.fn();
    const onError = vi.fn();
    await executeNotificationRequest({
      seqRef,
      run: async () => {
        seqRef.current += 1; // Supersede in flight
        return { success: true as const, data: { unreadCount: 9 } };
      },
      onSuccess,
      onError,
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
