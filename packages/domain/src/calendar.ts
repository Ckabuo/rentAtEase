import type { CalendarDate } from "./vocabulary";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseCalendarDate(value: CalendarDate): Date {
  if (!DATE_PATTERN.test(value)) {
    throw new Error("Calendar dates must be YYYY-MM-DD");
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatCalendarDate(date: Date): CalendarDate {
  return date.toISOString().slice(0, 10);
}

/** Human-readable calendar date for UI (e.g. 14 October 2026). */
export function formatCalendarDateDisplay(value: CalendarDate, locale = "en-NG"): string {
  const date = parseCalendarDate(value);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Whole days from `from` to `to`. Positive when `to` is later. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  const ms = parseCalendarDate(to).getTime() - parseCalendarDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function addCalendarDays(value: CalendarDate, days: number): CalendarDate {
  const date = parseCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatCalendarDate(date);
}

/**
 * Adds calendar months, anchored to the original day of `value`.
 * Month-end dates clamp to the last day of the target month (31 Jan + 1 month
 * is 28 or 29 Feb).
 */
export function addCalendarMonths(value: CalendarDate, months: number): CalendarDate {
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return formatCalendarDate(new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))));
}

export function maxCalendarDate(left: CalendarDate, right: CalendarDate): CalendarDate {
  return left >= right ? left : right;
}

export function minCalendarDate(left: CalendarDate, right: CalendarDate): CalendarDate {
  return left <= right ? left : right;
}
