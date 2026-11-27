"use client";

import Link from "next/link";
import { FolderKanban, CheckSquare, User as UserIcon, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatActivityEntry, formatUtcActivityTimestamp } from "../formatters";
import type { ActivityLogItemDTO } from "../types";

interface ActivityItemProps {
  item: ActivityLogItemDTO;
  hideProjectBadge?: boolean;
}

export function ActivityItem({
  item,
  hideProjectBadge = false,
}: ActivityItemProps) {
  const formatted = formatActivityEntry(item);
  const timestampLabel = formatUtcActivityTimestamp(item.createdAt);
  const actorInitial = item.actor.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <li className="relative flex items-start gap-3 py-3.5 px-4 border-b border-slate-100 dark:border-slate-800/80 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
      {/* Actor Avatar / Deleted User Indicator */}
      <div
        aria-hidden="true"
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
          item.actor.isDeleted
            ? "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
            : "border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300"
        }`}
      >
        {item.actor.isDeleted ? (
          <UserX className="h-3.5 w-3.5" />
        ) : actorInitial ? (
          <span>{actorInitial}</span>
        ) : (
          <UserIcon className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Main Content */}
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug break-words">
            <span
              className={`font-semibold ${
                item.actor.isDeleted
                  ? "text-slate-600 dark:text-slate-400 italic"
                  : "text-slate-900 dark:text-slate-100"
              }`}
            >
              {item.actor.name}
            </span>{" "}
            <span>{formatted.summary}</span>
          </p>

          <time
            dateTime={item.createdAt}
            className="font-mono text-[11px] text-slate-600 dark:text-slate-400 shrink-0 tabular-nums"
          >
            {timestampLabel}
          </time>
        </div>

        {/* Metadata note & Entity References */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={formatted.badgeVariant} size="sm">
            {formatted.badgeLabel}
          </Badge>

          {!hideProjectBadge && item.project ? (
            formatted.projectHref ? (
              <Link
                href={formatted.projectHref}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 max-w-full"
              >
                <FolderKanban className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[200px]">{item.project.label}</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-400">
                <FolderKanban className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[200px]">
                  {`${item.project.label} (deleted)`}
                </span>
              </span>
            )
          ) : null}

          {item.task ? (
            formatted.taskHref ? (
              <Link
                href={formatted.taskHref}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 max-w-full"
              >
                <CheckSquare className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[220px]">{item.task.label}</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-400">
                <CheckSquare className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[220px]">
                  {`${item.task.label}${item.task.isDeleted ? " (deleted)" : ""}`}
                </span>
              </span>
            )
          ) : null}

          {formatted.detailNote ? (
            <span className="text-xs text-slate-600 dark:text-slate-400 break-words">
              {formatted.detailNote}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
