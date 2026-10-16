import { addCalendarDays, addCalendarMonths } from "../calendar";
import type { CalendarDate, RentCycle } from "../vocabulary";

export interface ChargeDraft {
  periodStart: CalendarDate | null;
  periodEnd: CalendarDate | null;
  dueDate: CalendarDate;
  amountKobo: number;
}

export interface RentRateSnapshot {
  effectiveFrom: CalendarDate;
  amountKobo: number;
}

export interface GenerateChargesInput {
  startDate: CalendarDate;
  cycle: RentCycle;
  rentAmountKobo: number;
  throughDate: CalendarDate;
  /** Latest rate with effectiveFrom on or before the period start wins. */
  rates?: readonly RentRateSnapshot[];
}

const CYCLE_MONTHS: Record<RentCycle, number> = {
  ANNUAL: 12,
  BI_ANNUAL: 6,
  MONTHLY: 1,
};

/** Advance cover stops this many months after today. Callers pass that as throughDate. */
export const MAX_ADVANCE_MONTHS = 36;

/**
 * Generates cycle charges anchored to the tenancy start date.
 * A charge is included when its due date (the period start) is on or before throughDate.
 */
export function generateCharges(input: GenerateChargesInput): ChargeDraft[] {
  if (input.throughDate < input.startDate) return [];
  const step = CYCLE_MONTHS[input.cycle];
  const drafts: ChargeDraft[] = [];
  for (let index = 0; index < 240; index += 1) {
    const periodStart = addCalendarMonths(input.startDate, index * step);
    if (periodStart > input.throughDate) break;
    const nextStart = addCalendarMonths(input.startDate, (index + 1) * step);
    drafts.push({
      periodStart,
      periodEnd: addCalendarDays(nextStart, -1),
      dueDate: periodStart,
      amountKobo: amountForPeriod(periodStart, input),
    });
  }
  return drafts;
}

function amountForPeriod(periodStart: CalendarDate, input: GenerateChargesInput): number {
  const applicable = (input.rates ?? [])
    .filter((rate) => rate.effectiveFrom <= periodStart)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));
  return applicable[0]?.amountKobo ?? input.rentAmountKobo;
}
