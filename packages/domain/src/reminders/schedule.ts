import { addCalendarDays, daysBetween } from "../calendar";
import type { CalendarDate, RentCycle } from "../vocabulary";

export interface ReminderOffset {
  /** Negative is before the due date, positive is after. */
  daysFromDue: number;
  audience: "tenant" | "owner";
  templateKey: string;
}

/**
 * Annual timing is the schedule in the product requirements.
 * Bi-annual and monthly schedules are not specified yet.
 */
export const REMINDER_SCHEDULE: Record<RentCycle, readonly ReminderOffset[]> = {
  ANNUAL: [
    { daysFromDue: -30, audience: "tenant", templateKey: "rae_rent_reminder" },
    { daysFromDue: 3, audience: "tenant", templateKey: "rae_rent_overdue" },
    { daysFromDue: 7, audience: "tenant", templateKey: "rae_rent_overdue" },
    { daysFromDue: 14, audience: "tenant", templateKey: "rae_rent_overdue" },
    { daysFromDue: 30, audience: "owner", templateKey: "rae_owner_overdue" },
  ],
  BI_ANNUAL: [],
  MONTHLY: [],
};

export interface DueReminder {
  tenancyId: string;
  templateKey: string;
  audience: "tenant" | "owner";
  daysFromDue: number;
}

/** A reminder more than this many days past its send date is skipped. */
export const STALE_REMINDER_DAYS = 2;

export function remindersDue(input: {
  tenancyId: string;
  today: CalendarDate;
  cycle: RentCycle;
  dueDate: CalendarDate;
  outstandingKobo: number;
  whatsappConsent: boolean;
}): DueReminder[] {
  if (input.outstandingKobo <= 0 || !input.whatsappConsent) return [];
  const due: DueReminder[] = [];
  for (const offset of REMINDER_SCHEDULE[input.cycle]) {
    const sendOn = addCalendarDays(input.dueDate, offset.daysFromDue);
    const age = daysBetween(sendOn, input.today);
    if (age < 0 || age > STALE_REMINDER_DAYS) continue;
    due.push({
      tenancyId: input.tenancyId,
      templateKey: offset.templateKey,
      audience: offset.audience,
      daysFromDue: offset.daysFromDue,
    });
  }
  return due;
}
