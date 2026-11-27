"use client";

import { AlertCircle, Check, FolderKanban, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatNotificationRelativeTime,
  formatNotificationTimestampUtc,
} from "../formatters";
import type { NotificationItemDTO } from "../types";

interface NotificationItemProps {
  item: NotificationItemDTO;
  nowMs: number | null;
  isPending: boolean;
  onOpenItem: (item: NotificationItemDTO) => void;
  onMarkRead: (notificationId: string) => void;
}

export function NotificationItem({
  item,
  nowMs,
  isPending,
  onOpenItem,
  onMarkRead,
}: NotificationItemProps) {
  const actorInitial = item.actor.name.trim().charAt(0).toUpperCase() || "?";
  const timeLabel =
    nowMs === null
      ? formatNotificationTimestampUtc(item.createdAt)
      : formatNotificationRelativeTime(item.createdAt, nowMs);

  const rowBody = (
    <div className="flex items-start gap-2.5 min-w-0 flex-1 text-left">
      {/* Actor Avatar / Unavailable Icon */}
      <div
        aria-hidden="true"
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
          !item.isAccessible
            ? "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
            : item.actor.isDeleted
              ? "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
              : "border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300"
        }`}
      >
        {!item.isAccessible ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : item.actor.isDeleted ? (
          <UserX className="h-3.5 w-3.5" />
        ) : (
          <span>{actorInitial}</span>
        )}
      </div>

      {/* Text Content */}
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {!item.isRead && (
              <>
                <span
                  className="h-2 w-2 rounded-full bg-teal-700 dark:bg-teal-400 shrink-0"
                  aria-hidden="true"
                />
                <span className="sr-only">Unread</span>
              </>
            )}
            <span
              className={`truncate text-xs font-semibold ${
                item.actor.isDeleted || !item.isAccessible
                  ? "text-slate-600 dark:text-slate-400 italic"
                  : "text-slate-900 dark:text-slate-100"
              }`}
            >
              {item.actor.name}
            </span>
          </div>

          <time
            dateTime={item.createdAt}
            title={formatNotificationTimestampUtc(item.createdAt)}
            className="font-mono text-[11px] text-slate-600 dark:text-slate-400 shrink-0 tabular-nums"
          >
            {timeLabel}
          </time>
        </div>

        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">
          {item.title}
        </p>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
          {item.message}
        </p>

        {item.team && (
          <div className="pt-0.5">
            <Badge variant="slate" size="sm">
              <FolderKanban className="h-2.5 w-2.5" aria-hidden="true" />
              <span className="truncate max-w-[160px]">{item.team.name}</span>
            </Badge>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <li
      className={`border-b border-slate-100 dark:border-slate-800/80 last:border-b-0 transition-colors ${
        !item.isRead
          ? "bg-teal-50/40 dark:bg-teal-950/20"
          : "bg-transparent"
      }`}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        {item.isAccessible ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onOpenItem(item)}
            className="flex-1 min-w-0 rounded-md p-1 -m-1 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors cursor-pointer disabled:opacity-60 text-left"
          >
            {rowBody}
          </button>
        ) : (
          <div className="flex-1 min-w-0 p-1 -m-1 opacity-85">{rowBody}</div>
        )}

        {!item.isRead && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onMarkRead(item.id)}
            title={`Mark notification "${item.title}" as read`}
            className="mt-1 shrink-0 inline-flex min-h-[44px] md:min-h-0 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-teal-700 hover:text-teal-700 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Check className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Mark as read</span>
            <span className="sr-only">{` for ${item.title}`}</span>
          </button>
        )}
      </div>
    </li>
  );
}
