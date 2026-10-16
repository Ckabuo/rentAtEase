export {
  nextResendAt,
  OTP_CODE_TTL_SECONDS,
  OTP_SEND_WINDOW_MS,
  resendCooldownSeconds,
  secondsUntil,
} from "./auth/otp";
export type { OtpChannel } from "./auth/otp";
export {
  addCalendarDays,
  addCalendarMonths,
  daysBetween,
  formatCalendarDate,
  formatCalendarDateDisplay,
  parseCalendarDate,
} from "./calendar";
export { NotImplemented } from "./errors";
export { formatNaira, koboToNaira, nairaToKobo, parseWholeNairaInput } from "./money";
export {
  isValidNigerianPhone,
  NIGERIAN_PHONE_LENGTH,
  NIGERIAN_PHONE_PATTERN,
  normalizeNigerianPhoneInput,
} from "./phone";
export { canAddCaretaker, canAddUnit, canRunPrequalification, PLANS } from "./plans";
export type { PlanLimits } from "./plans";
export { isDuplicatePayment, DUPLICATE_WINDOW_HOURS } from "./payments/duplicates";
export type { PaymentFingerprint } from "./payments/duplicates";
export { formatReceiptNumber, receiptNumberPrefix, sha256Hex } from "./receipts/numbering";
export type { ReceiptNumberInput } from "./receipts/numbering";
export { remindersDue, REMINDER_SCHEDULE, STALE_REMINDER_DAYS } from "./reminders/schedule";
export type { DueReminder, ReminderOffset } from "./reminders/schedule";
export { generateCharges, MAX_ADVANCE_MONTHS } from "./ledger/charges";
export type { ChargeDraft, GenerateChargesInput, RentRateSnapshot } from "./ledger/charges";
export { previewAllocation } from "./ledger/allocation";
export type { AllocationLine, AllocationPreview, OpenCharge } from "./ledger/allocation";
export { rentStatus, DUE_SOON_DAYS, RENT_STATUSES } from "./ledger/status";
export type { RentStatus, RentStatusInput, RentStatusResult } from "./ledger/status";
export { RUBRIC_VERSION, RUBRIC_WEIGHTS, SCORE_THRESHOLDS } from "./scoring/rubric";
export type { ScoreComponent } from "./scoring/rubric";
export { monthlyRentEquivalent, scoreApplication } from "./scoring/score";
export type { DeclaredApplication, ScoreResult } from "./scoring/score";
export {
  ACCOUNT_ROLES,
  APPLICATION_DECISIONS,
  CHARGE_STATUSES,
  PAYMENT_CATEGORIES,
  PAYMENT_METHODS,
  PLAN_CODES,
  RECOMMENDATIONS,
  REFERENCE_STANDINGS,
  RENT_CYCLES,
  UNIT_TYPES,
} from "./vocabulary";
export type {
  AccountRole,
  ApplicationDecision,
  CalendarDate,
  ChargeStatus,
  PaymentCategory,
  PaymentMethod,
  PlanCode,
  Recommendation,
  ReferenceStanding,
  RentCycle,
  UnitType,
} from "./vocabulary";
