const UTC_NOTIFICATION_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
  timeZoneName: "short",
});

/**
 * Formats unread badge counts according to DESIGN_GUIDELINES.md §16.3:
 * hidden for <= 0, exact digits for 1..9, "9+" for 10+.
 */
export function formatUnreadBadgeCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  return count >= 10 ? "9+" : String(Math.floor(count));
}

/**
 * Deterministic UTC timestamp formatter for SSR & initial hydration parity.
 */
export function formatNotificationTimestampUtc(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return UTC_NOTIFICATION_TIMESTAMP_FORMATTER.format(date);
}

/**
 * Client-side relative timestamp formatter (call only after mount / with explicit nowMs
 * so SSR and client hydration never diverge).
 */
export function formatNotificationRelativeTime(
  value: string | Date | null | undefined,
  nowMs: number,
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  const targetMs = date.getTime();
  if (Number.isNaN(targetMs)) {
    return "—";
  }

  const diffSeconds = Math.floor((nowMs - targetMs) / 1000);
  if (diffSeconds < 0) {
    return formatNotificationTimestampUtc(date);
  }
  if (diffSeconds < 60) {
    return "Just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return formatNotificationTimestampUtc(date);
}
