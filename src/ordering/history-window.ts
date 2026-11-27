import { qatarDate } from "@/ordering/operations-calendar";

/**
 * Floor-ops display window for CMS lists (order history, activity).
 * Older rows stay in the database for audit / retention; they are not shown.
 * One owner — callers reuse these helpers.
 */
export const HISTORY_DISPLAY_DAYS = 31;

/** Inclusive earliest Qatar calendar day visible in history (today − (days−1)). */
export function historyEarliestDate(now = new Date()): string {
  return qatarDate(new Date(now.getTime() - (HISTORY_DISPLAY_DAYS - 1) * 86_400_000));
}

export function historyLatestDate(now = new Date()): string {
  return qatarDate(now);
}

/** Clamp a requested `from` so history never opens before the display window. */
export function clampHistoryFrom(from: string | undefined, now = new Date()): string {
  const earliest = historyEarliestDate(now);
  if (!from || from < earliest) return earliest;
  return from;
}

/** True when a closed range fits inside the display window. */
export function historyRangeAllowed(from: string, to: string, now = new Date()): boolean {
  if (from > to) return false;
  const earliest = historyEarliestDate(now);
  const latest = historyLatestDate(now);
  if (from < earliest || to > latest) return false;
  const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  return spanDays < HISTORY_DISPLAY_DAYS;
}
