import type { Recommendation, ReferenceStanding, RentCycle } from "../vocabulary";
import { RUBRIC_VERSION, SCORE_THRESHOLDS, type ScoreComponent } from "./rubric";

/** Declared inputs only. Nothing here is treated as verified. */
export interface DeclaredApplication {
  employmentStatus: string;
  yearsInCurrentJob: number | null;
  monthlyIncomeKobo: number;
  incomeSource: string;
  rentAmountKobo: number;
  rentCycle: RentCycle;
  guarantorAvailable: boolean;
  guarantorWillSign: boolean;
  guarantorEmployment: string | null;
  idDocumentProvided: boolean;
  proofOfIncomeProvided: boolean;
  idNumberFormatValid: boolean;
  reference: ReferenceStanding;
}

export interface ScoreResult {
  rubricVersion: typeof RUBRIC_VERSION;
  score: number;
  breakdown: Record<ScoreComponent, number>;
  recommendation: Recommendation;
}

const REFERENCE_POINTS: Record<ReferenceStanding, number> = {
  VERIFIED_GOOD_STANDING: 10,
  PROVIDED: 7,
  FIRST_TIME_RENTER: 4,
  NONE: 0,
};

/**
 * Proposed rubric from the product requirements.
 * Employment 30, income 25, guarantor 20, documents 15, reference 10.
 * 75+ recommends approval, 50–74 review, below 50 decline. Advice only.
 */
export function scoreApplication(input: DeclaredApplication): ScoreResult {
  const breakdown: Record<ScoreComponent, number> = {
    employment: employmentPoints(input.employmentStatus, input.yearsInCurrentJob),
    income: incomePoints(input),
    guarantor: guarantorPoints(input),
    documents: documentPoints(input),
    reference: REFERENCE_POINTS[input.reference],
  };
  const score = Object.values(breakdown).reduce((sum, points) => sum + points, 0);
  return {
    rubricVersion: RUBRIC_VERSION,
    score,
    breakdown,
    recommendation: recommend(score),
  };
}

export function monthlyRentEquivalent(rentAmountKobo: number, cycle: RentCycle): number {
  if (cycle === "ANNUAL") return Math.round(rentAmountKobo / 12);
  if (cycle === "BI_ANNUAL") return Math.round(rentAmountKobo / 6);
  return rentAmountKobo;
}

function recommend(score: number): Recommendation {
  if (score >= SCORE_THRESHOLDS.approveAt) return "APPROVE";
  if (score >= SCORE_THRESHOLDS.reviewAt) return "REVIEW";
  return "DECLINE";
}

function employmentPoints(status: string, yearsInCurrentJob: number | null): number {
  const key = normalize(status);
  let base = 0;
  if (key === "employed" || key === "salary") base = 18;
  else if (key === "self_employed" || key === "business" || key === "business_owner") base = 16;
  else if (key === "contract" || key === "contract_staff") base = 12;
  else if (key === "student") base = 6;
  const years = yearsInCurrentJob ?? 0;
  const bonus = years >= 3 ? 12 : years >= 2 ? 8 : years >= 1 ? 4 : 0;
  return Math.min(30, base + bonus);
}

function incomePoints(input: DeclaredApplication): number {
  const monthlyRent = monthlyRentEquivalent(input.rentAmountKobo, input.rentCycle);
  let ratioPoints = 0;
  if (monthlyRent > 0) {
    const ratio = input.monthlyIncomeKobo / monthlyRent;
    if (ratio >= 3) ratioPoints = 18;
    else if (ratio >= 2) ratioPoints = 14;
    else if (ratio >= 1.5) ratioPoints = 10;
    else if (ratio >= 1) ratioPoints = 6;
    else ratioPoints = 2;
  }
  return Math.min(25, ratioPoints + incomeSourcePoints(input.incomeSource));
}

function incomeSourcePoints(source: string): number {
  const key = normalize(source);
  if (key.includes("salary") || key === "employed" || key === "employment" || key.includes("wage")) return 7;
  if (key.includes("business") || key.includes("self")) return 5;
  if (key.includes("pension") || key.includes("allowance") || key.includes("remittance")) return 3;
  return 2;
}

function guarantorPoints(input: DeclaredApplication): number {
  let points = 0;
  if (input.guarantorAvailable) points += 8;
  if (input.guarantorWillSign) points += 7;
  const employment = normalize(input.guarantorEmployment ?? "");
  if (employment && employment !== "unemployed" && employment !== "none" && employment !== "n_a") {
    points += 5;
  }
  return Math.min(20, points);
}

function documentPoints(input: DeclaredApplication): number {
  return (
    (input.idDocumentProvided ? 6 : 0) +
    (input.proofOfIncomeProvided ? 5 : 0) +
    (input.idNumberFormatValid ? 4 : 0)
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}
