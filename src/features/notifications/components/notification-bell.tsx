"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/features/teams/actions";
import {
  getNotificationsAction,
  getUnreadCountAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
} from "../actions";
import {
  NOTIFICATIONS_DEFAULT_LIMIT,
  NOTIFICATIONS_POLL_INTERVAL_MS,
} from "../constants";
import { formatUnreadBadgeCount } from "../formatters";
import type { NotificationFilter, NotificationItemDTO } from "../types";
import { NotificationItem } from "./notification-item";

export type NotificationPopoverPlacement =
  | "desktop-expanded"
  | "desktop-collapsed"
  | "mobile";

export function mergeNotificationItems(
  existing: NotificationItemDTO[],
  incoming: NotificationItemDTO[],
): NotificationItemDTO[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((item) => item.id));
  const appended: NotificationItemDTO[] = [];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      appended.push(item);
    }
  }
  return appended.length > 0 ? [...existing, ...appended] : existing;
}

export function markItemReadLocally(
  items: NotificationItemDTO[],
  notificationId: string,
  readAtIso: string,
): NotificationItemDTO[] {
  return items.map((item) =>
    item.id === notificationId
      ? { ...item, isRead: true, readAt: item.readAt ?? readAtIso }
      : item,
  );
}

export function markAllReadLocally(
  items: NotificationItemDTO[],
  readAtIso: string,
): NotificationItemDTO[] {
  return items.map((item) =>
    item.isRead ? item : { ...item, isRead: true, readAt: readAtIso },
  );
}

export function shouldPollNotifications(
  visibilityState: DocumentVisibilityState | undefined,
): boolean {
  return visibilityState === "visible";
}

export async function executeNotificationRequest<T>(params: {
  seqRef: { current: number };
  run: () => Promise<ActionResult<T>>;
  onSuccess: (data: T) => void;
  onError: (message: string) => void;
  onFinally?: () => void;
}): Promise<void> {
  const requestSeq = params.seqRef.current;
  try {
    const result = await params.run();
    if (requestSeq !== params.seqRef.current) {
      return;
    }

    if (!result.success) {
      params.onError(result.error);
      return;
    }

    params.onSuccess(result.data);
  } catch {
    if (requestSeq !== params.seqRef.current) {
      return;
    }
    params.onError("Unable to load notifications. Please try again.");
  } finally {
    if (requestSeq === params.seqRef.current) {
      params.onFinally?.();
    }
  }
}

export interface NotificationCenterController {
  popoverId: string;
  unreadCount: number;
  isOpen: boolean;
  placement: NotificationPopoverPlacement;
  items: NotificationItemDTO[];
  filter: NotificationFilter;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isMarkingAll: boolean;
  pendingItemIds: Set<string>;
  error: string | null;
  unavailableNotice: string | null;
  nowMs: number | null;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  togglePopover: (
    nextPlacement: NotificationPopoverPlacement,
    triggerEl: HTMLButtonElement | null,
  ) => void;
  closePopover: (restoreFocus?: boolean) => void;
  changeFilter: (nextFilter: NotificationFilter) => void;
  markAllRead: () => void;
  markRead: (notificationId: string) => void;
  openItem: (item: NotificationItemDTO) => void;
  loadMore: () => void;
  retry: () => void;
}

/**
 * Shared state owner and single 30-second visibility-gated polling lifecycle for
 * both desktop sidebar footer and mobile top header Notification Bell triggers.
 */
export function useNotificationCenter(
  initialUnreadCount: number,
): NotificationCenterController {
  const router = useRouter();
  const popoverId = useId();

  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] =
    useState<NotificationPopoverPlacement>("desktop-expanded");
  const [items, setItems] = useState<NotificationItemDTO[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [unavailableNotice, setUnavailableNotice] = useState<string | null>(
    null,
  );
  const [nowMs, setNowMs] = useState<number | null>(null);

  const [prevInitialCount, setPrevInitialCount] = useState(initialUnreadCount);
  if (prevInitialCount !== initialUnreadCount) {
    setPrevInitialCount(initialUnreadCount);
    setUnreadCount(initialUnreadCount);
  }

  const listSeqRef = useRef(0);
  const countSeqRef = useRef(0);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const loadNotificationsPage = useCallback(
    async (
      targetFilter: NotificationFilter,
      cursor: string | null,
      mode: "replace" | "append",
    ) => {
      const seq = ++listSeqRef.current;
      if (mode === "replace") {
        setIsLoading(true);
        setIsLoadingMore(false);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      await executeNotificationRequest({
        seqRef: listSeqRef,
        run: () =>
          getNotificationsAction({
            limit: NOTIFICATIONS_DEFAULT_LIMIT,
            filter: targetFilter,
            ...(cursor ? { cursor } : {}),
          }),
        onSuccess: (page) => {
          if (seq !== listSeqRef.current) return;
          setUnreadCount(page.unreadCount);
          setNextCursor(page.nextCursor);
          setHasMore(page.hasMore);
          setNowMs(Date.now());
          setItems((prev) =>
            mode === "append"
              ? mergeNotificationItems(prev, page.items)
              : page.items,
          );
        },
        onError: (msg) => {
          if (seq !== listSeqRef.current) return;
          setError(msg);
        },
        onFinally: () => {
          if (seq !== listSeqRef.current) return;
          setIsLoading(false);
          setIsLoadingMore(false);
        },
      });
    },
    [],
  );

  const refreshUnreadCount = useCallback(async () => {
    const seq = ++countSeqRef.current;
    try {
      const res = await getUnreadCountAction();
      if (seq !== countSeqRef.current || !res.success) {
        return;
      }
      setUnreadCount(res.data.unreadCount);
    } catch {
      // Transient polling errors are ignored silently to avoid UI disruption.
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (shouldPollNotifications(document.visibilityState)) {
        void refreshUnreadCount();
      }
    }, NOTIFICATIONS_POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (shouldPollNotifications(document.visibilityState)) {
        setNowMs(Date.now());
        void refreshUnreadCount();
        if (isOpen) {
          void loadNotificationsPage(filter, null, "replace");
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [filter, isOpen, loadNotificationsPage, refreshUnreadCount]);

  const closePopover = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus && lastTriggerRef.current) {
      lastTriggerRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePopover(true);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (target.closest("[data-notification-bell-trigger='true']")) return;
      closePopover(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [closePopover, isOpen]);

  const togglePopover = useCallback(
    (
      nextPlacement: NotificationPopoverPlacement,
      triggerEl: HTMLButtonElement | null,
    ) => {
      lastTriggerRef.current = triggerEl;
      if (isOpen) {
        closePopover(false);
        return;
      }

      setPlacement(nextPlacement);
      setUnavailableNotice(null);
      setNowMs(Date.now());
      setIsOpen(true);
      void loadNotificationsPage(filter, null, "replace");
    },
    [closePopover, filter, isOpen, loadNotificationsPage],
  );

  const changeFilter = useCallback(
    (nextFilter: NotificationFilter) => {
      if (nextFilter === filter) return;
      setFilter(nextFilter);
      setItems([]);
      setNextCursor(null);
      setHasMore(false);
      setUnavailableNotice(null);
      void loadNotificationsPage(nextFilter, null, "replace");
    },
    [filter, loadNotificationsPage],
  );

  const setItemPending = useCallback((id: string, pending: boolean) => {
    setPendingItemIds((prev) => {
      const next = new Set(prev);
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const markRead = useCallback(
    async (notificationId: string) => {
      setItemPending(notificationId, true);
      try {
        const res = await markNotificationReadAction({ notificationId });
        if (!res.success) {
          setError(res.error);
          return;
        }
        ++countSeqRef.current;
        setUnreadCount(res.data.unreadCount);
        setItems((prev) => {
          const updated = markItemReadLocally(
            prev,
            notificationId,
            res.data.readAt,
          );
          return filter === "unread"
            ? updated.filter((item) => !item.isRead)
            : updated;
        });
      } catch {
        setError("Unable to update notification. Please try again.");
      } finally {
        setItemPending(notificationId, false);
      }
    },
    [filter, setItemPending],
  );

  const markAllRead = useCallback(async () => {
    setIsMarkingAll(true);
    setError(null);
    try {
      const res = await markAllNotificationsReadAction();
      if (!res.success) {
        setError(res.error);
        return;
      }
      ++countSeqRef.current;
      const nowIso = new Date().toISOString();
      setUnreadCount(res.data.unreadCount);
      setItems((prev) =>
        filter === "unread" ? [] : markAllReadLocally(prev, nowIso),
      );
      if (filter === "unread") {
        setHasMore(false);
        setNextCursor(null);
      }
    } catch {
      setError("Unable to mark notifications as read. Please try again.");
    } finally {
      setIsMarkingAll(false);
    }
  }, [filter]);

  const openItem = useCallback(
    async (item: NotificationItemDTO) => {
      setItemPending(item.id, true);
      setUnavailableNotice(null);
      setError(null);
      try {
        const res = await openNotificationAction({ notificationId: item.id });
        if (!res.success) {
          setError(res.error);
          return;
        }

        ++countSeqRef.current;
        setUnreadCount(res.data.unreadCount);
        setItems((prev) => {
          const updated = prev.map((existing) =>
            existing.id === item.id
              ? {
                  ...existing,
                  isRead: true,
                  readAt: existing.readAt ?? res.data.readAt,
                  isAccessible: res.data.isAccessible,
                  href: res.data.href,
                  ...(res.data.unavailableReason
                    ? { message: res.data.unavailableReason }
                    : {}),
                }
              : existing,
          );
          return filter === "unread"
            ? updated.filter((existing) => !existing.isRead)
            : updated;
        });

        if (res.data.isAccessible && res.data.href) {
          closePopover(false);
          router.push(res.data.href);
        } else {
          setUnavailableNotice(
            res.data.unavailableReason ?? "This item is no longer available.",
          );
        }
      } catch {
        setError("Unable to open notification. Please try again.");
      } finally {
        setItemPending(item.id, false);
      }
    },
    [closePopover, filter, router, setItemPending],
  );

  const loadMore = useCallback(() => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    void loadNotificationsPage(filter, nextCursor, "append");
  }, [filter, hasMore, isLoadingMore, loadNotificationsPage, nextCursor]);

  const retry = useCallback(() => {
    void loadNotificationsPage(filter, null, "replace");
  }, [filter, loadNotificationsPage]);

  return {
    popoverId,
    unreadCount,
    isOpen,
    placement,
    items,
    filter,
    hasMore,
    isLoading,
    isLoadingMore,
    isMarkingAll,
    pendingItemIds,
    error,
    unavailableNotice,
    nowMs,
    popoverRef,
    togglePopover,
    closePopover,
    changeFilter,
    markAllRead,
    markRead,
    openItem,
    loadMore,
    retry,
  };
}

interface NotificationBellTriggerProps {
  unreadCount: number;
  isOpen: boolean;
  popoverId: string;
  variant: NotificationPopoverPlacement;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function NotificationBellTrigger({
  unreadCount,
  isOpen,
  popoverId,
  variant,
  onClick,
}: NotificationBellTriggerProps) {
  const badgeLabel = formatUnreadBadgeCount(unreadCount);
  const ariaLabel = `Notifications, ${unreadCount} unread`;

  if (variant === "desktop-expanded") {
    return (
      <button
        type="button"
        data-notification-bell-trigger="true"
        title={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-haspopup="dialog"
        onClick={onClick}
        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer min-h-[36px] ${
          isOpen
            ? "bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="relative inline-flex shrink-0">
            <Bell className="h-4 w-4" aria-hidden="true" />
            {badgeLabel && (
              <span
                aria-hidden="true"
                className="absolute -top-1.5 -right-2 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-[--color-priority-high] px-1 text-[10px] font-semibold leading-none text-white"
              >
                {badgeLabel}
              </span>
            )}
          </span>
          <span className="truncate">Notifications</span>
          <span className="sr-only">{`, ${unreadCount} unread`}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-notification-bell-trigger="true"
      title={ariaLabel}
      aria-label={ariaLabel}
      aria-expanded={isOpen}
      aria-controls={popoverId}
      aria-haspopup="dialog"
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer ${
        variant === "mobile" ? "min-h-[44px] min-w-[44px]" : "h-9 w-9"
      } ${
        isOpen
          ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
      }`}
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {badgeLabel && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-[--color-priority-high] px-1 text-[10px] font-semibold leading-none text-white"
        >
          {badgeLabel}
        </span>
      )}
    </button>
  );
}

interface NotificationPopoverProps {
  id: string;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
  items: NotificationItemDTO[];
  unreadCount: number;
  filter: NotificationFilter;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isMarkingAll: boolean;
  pendingItemIds: Set<string>;
  error: string | null;
  unavailableNotice: string | null;
  nowMs?: number | null;
  placement: NotificationPopoverPlacement;
  onClose: () => void;
  onFilterChange: (filter: NotificationFilter) => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onOpenItem: (item: NotificationItemDTO) => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function NotificationPopover({
  id,
  popoverRef,
  items,
  unreadCount,
  filter,
  hasMore,
  isLoading,
  isLoadingMore,
  isMarkingAll,
  pendingItemIds,
  error,
  unavailableNotice,
  nowMs = null,
  placement,
  onClose,
  onFilterChange,
  onMarkAllRead,
  onMarkRead,
  onOpenItem,
  onLoadMore,
  onRetry,
}: NotificationPopoverProps) {
  const localPopoverRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<NotificationFilter, HTMLButtonElement | null>>({
    all: null,
    unread: null,
  });

  useEffect(() => {
    const dialogEl = popoverRef?.current ?? localPopoverRef.current;
    dialogEl?.focus();
  }, [popoverRef]);

  const positionClasses =
    placement === "mobile"
      ? "fixed top-16 right-3 left-3 sm:left-auto sm:w-96 z-50"
      : placement === "desktop-collapsed"
        ? "fixed bottom-4 left-[68px] w-96 max-w-[calc(100vw-84px)] z-50"
        : "fixed bottom-4 left-[248px] w-96 max-w-[calc(100vw-264px)] z-50";

  const tabs: readonly NotificationFilter[] = ["all", "unread"];

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const nextTab = tabs[nextIndex]!;
      tabRefs.current[nextTab]?.focus();
      onFilterChange(nextTab);
    }
  }

  const panelId = `${id}-panel`;
  const activeTabId = `${id}-tab-${filter}`;

  return (
    <div
      id={id}
      ref={(el) => {
        localPopoverRef.current = el;
        if (popoverRef) {
          popoverRef.current = el;
        }
      }}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-label="Notifications"
      className={`${positionClasses} flex max-h-[min(32rem,calc(100vh-5rem))] flex-col rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg focus:outline-none`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 tabular-nums">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={unreadCount === 0 || isMarkingAll}
            onClick={onMarkAllRead}
            className="inline-flex min-h-[44px] md:min-h-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isMarkingAll ? "Marking..." : "Mark all as read"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="inline-flex min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-[32px] items-center justify-center rounded-md p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label="Filter notifications"
        className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 px-3 py-1.5 bg-slate-50/70 dark:bg-slate-900/60"
      >
        {tabs.map((tab, index) => {
          const selected = filter === tab;
          return (
            <button
              key={tab}
              ref={(el) => {
                tabRefs.current[tab] = el;
              }}
              id={`${id}-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onFilterChange(tab)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              className={`min-h-[44px] md:min-h-0 rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 cursor-pointer ${
                selected
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {tab === "all" ? "All" : "Unread"}
            </button>
          );
        })}
      </div>

      {/* Unavailable Banner */}
      {unavailableNotice && (
        <div
          role="status"
          className="border-b border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-200"
        >
          {unavailableNotice}
        </div>
      )}

      {/* Content */}
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={activeTabId}
        className="flex-1 overflow-y-auto"
      >
        {isLoading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-10 text-xs text-slate-600 dark:text-slate-400"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Loading notifications...</span>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-2.5 px-4 py-8 text-center"
          >
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={onRetry}
            >
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
            <Bell
              className="h-6 w-6 text-slate-400 dark:text-slate-600 mb-1"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {filter === "unread"
                ? "You're all caught up"
                : "No notifications yet"}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {filter === "unread"
                ? "All of your notifications have been read."
                : "Task assignments, status updates, and project completions appear here."}
            </p>
          </div>
        ) : (
          <ul>
            {items.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                nowMs={nowMs}
                isPending={pendingItemIds.has(item.id)}
                onOpenItem={onOpenItem}
                onMarkRead={onMarkRead}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer / Pagination */}
      {!isLoading && !error && hasMore && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-2 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            isLoading={isLoadingMore}
            onClick={onLoadMore}
            className="w-full"
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
