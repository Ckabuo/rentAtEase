import type { CalendarDate, PaymentMethod } from "../vocabulary";

/** Warn when the same tenancy, amount, date and method appear inside this window. */
export const DUPLICATE_WINDOW_HOURS = 24;

export interface PaymentFingerprint {
  tenancyId: string;
  amountKobo: number;
  paidOn: CalendarDate;
  method: PaymentMethod;
  recordedAt: string;
}

export function isDuplicatePayment(candidate: PaymentFingerprint, recent: PaymentFingerprint[]): boolean {
  const candidateTime = Date.parse(candidate.recordedAt);
  if (Number.isNaN(candidateTime)) return false;
  return recent.some((item) => {
    if (item.tenancyId !== candidate.tenancyId) return false;
    if (item.amountKobo !== candidate.amountKobo) return false;
    if (item.paidOn !== candidate.paidOn) return false;
    if (item.method !== candidate.method) return false;
    const then = Date.parse(item.recordedAt);
    if (Number.isNaN(then)) return false;
    return Math.abs(candidateTime - then) / 3_600_000 <= DUPLICATE_WINDOW_HOURS;
  });
}
