const UTC_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const UTC_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Parses a YYYY-MM-DD date string strictly into a UTC midnight Date.
 * - Empty/whitespace strings return null.
 * - Malformed or impossible calendar dates (e.g. 2026-02-30) return undefined.
 */
export function parseUtcDateInput(value: string): Date | null | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = UTC_DATE_REGEX.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return undefined;
  }

  return utcDate;
}

/**
 * Formats a Date into an HTML <input type="date"> string using UTC.
 */
export function toUtcDateInputValue(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Formats a date-only project value strictly in UTC to avoid timezone day shifts.
 */
export function formatUtcDateLabel(date: Date | null | undefined): string | null {
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  return UTC_DATE_FORMATTER.format(date);
}

/**
 * Compares two nullable Dates by epoch timestamp.
 */
export function areUtcDatesEqual(a: Date | null, b: Date | null): boolean {
  return (a ? a.getTime() : null) === (b ? b.getTime() : null);
}
