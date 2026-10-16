export const PLAN_CODES = ["STARTER", "STANDARD", "PRO"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const RENT_CYCLES = ["ANNUAL", "BI_ANNUAL", "MONTHLY"] as const;
export type RentCycle = (typeof RENT_CYCLES)[number];

export const ACCOUNT_ROLES = ["OWNER", "CARETAKER"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const UNIT_TYPES = ["FLAT", "SELF_CONTAIN", "SHOP_OFFICE", "WAREHOUSE", "OTHER"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "POS", "CHEQUE", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_CATEGORIES = [
  "RENT",
  "CAUTION_DEPOSIT",
  "AGENCY_FEE",
  "LEGAL_FEE",
  "SERVICE_CHARGE",
  "OTHER",
] as const;
export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];

export const CHARGE_STATUSES = ["UNPAID", "PART_PAID", "PAID"] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const APPLICATION_DECISIONS = ["APPROVE", "REQUEST_INFORMATION", "DECLINE"] as const;
export type ApplicationDecision = (typeof APPLICATION_DECISIONS)[number];

export const RECOMMENDATIONS = ["APPROVE", "REVIEW", "DECLINE"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const REFERENCE_STANDINGS = [
  "VERIFIED_GOOD_STANDING",
  "PROVIDED",
  "FIRST_TIME_RENTER",
  "NONE",
] as const;
export type ReferenceStanding = (typeof REFERENCE_STANDINGS)[number];

/** Calendar dates are ISO `YYYY-MM-DD` strings in Africa/Lagos, never instants. */
export type CalendarDate = string;
