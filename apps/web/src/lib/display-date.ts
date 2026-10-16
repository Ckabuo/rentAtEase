import { formatCalendarDateDisplay, type CalendarDate } from "@rae/domain";

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Format YYYY-MM-DD for display; returns the original string if it is not a calendar date. */
export function displayDate(value: string | null | undefined): string {
  if (!value) return "";
  if (!CALENDAR_DATE.test(value)) return value;
  return formatCalendarDateDisplay(value as CalendarDate);
}
