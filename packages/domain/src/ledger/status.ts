import { daysBetween } from "../calendar";
import type { CalendarDate, ChargeStatus } from "../vocabulary";

export const RENT_STATUSES = ["PAID", "DUE_SOON", "OVERDUE", "PART_PAID"] as const;
export type RentStatus = (typeof RENT_STATUSES)[number];

/** "Due soon" matches the first reminder window in the product requirements. */
export const DUE_SOON_DAYS = 14;

export interface RentStatusInput {
  today: CalendarDate;
  dueDate: CalendarDate | null;
  chargeStatus: ChargeStatus;
  outstandingKobo: number;
}

export interface RentStatusResult {
  status: RentStatus;
  outstandingKobo: number;
}

export function rentStatus(input: RentStatusInput): RentStatusResult {
  const outstandingKobo = Math.max(0, input.outstandingKobo);
  if (outstandingKobo === 0 || input.chargeStatus === "PAID") {
    return { status: "PAID", outstandingKobo: 0 };
  }
  if (input.dueDate && input.today > input.dueDate) {
    return { status: "OVERDUE", outstandingKobo };
  }
  if (input.chargeStatus === "PART_PAID") {
    return { status: "PART_PAID", outstandingKobo };
  }
  if (input.dueDate && daysBetween(input.today, input.dueDate) <= DUE_SOON_DAYS) {
    return { status: "DUE_SOON", outstandingKobo };
  }
  return { status: "DUE_SOON", outstandingKobo };
}
