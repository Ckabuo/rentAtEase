import type { PlanCode } from "./vocabulary";

export interface PlanLimits {
  code: PlanCode;
  name: string;
  monthlyPriceKobo: number;
  /** Null means unlimited. */
  unitLimit: number | null;
  /** Null means unlimited. Counted per calendar month. */
  prequalificationsPerMonth: number | null;
  caretakerLimit: number;
  whatsappEnabled: boolean;
  reports: "BASIC" | "STANDARD" | "ADVANCED";
}

/** Pricing from the product requirements. Null limits mean unlimited. */
export const PLANS: Record<PlanCode, PlanLimits> = {
  STARTER: {
    code: "STARTER",
    name: "Starter",
    monthlyPriceKobo: 0,
    unitLimit: 3,
    prequalificationsPerMonth: 1,
    caretakerLimit: 1,
    whatsappEnabled: true,
    reports: "BASIC",
  },
  STANDARD: {
    code: "STANDARD",
    name: "Standard",
    monthlyPriceKobo: 500_000,
    unitLimit: 15,
    prequalificationsPerMonth: null,
    caretakerLimit: 2,
    whatsappEnabled: true,
    reports: "STANDARD",
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    monthlyPriceKobo: 1_500_000,
    unitLimit: null,
    prequalificationsPerMonth: null,
    caretakerLimit: 5,
    whatsappEnabled: true,
    reports: "ADVANCED",
  },
};

export function canAddUnit(plan: PlanCode, currentUnits: number): boolean {
  const limit = PLANS[plan].unitLimit;
  return limit === null || currentUnits < limit;
}

export function canAddCaretaker(plan: PlanCode, currentCaretakers: number): boolean {
  return currentCaretakers < PLANS[plan].caretakerLimit;
}

export function canRunPrequalification(plan: PlanCode, completedThisMonth: number): boolean {
  const limit = PLANS[plan].prequalificationsPerMonth;
  return limit === null || completedThisMonth < limit;
}
