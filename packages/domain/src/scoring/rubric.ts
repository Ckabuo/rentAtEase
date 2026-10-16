/**
 * Proposed pre-qualification rubric (PRD). A rubric change must bump RUBRIC_VERSION.
 * Old applications keep the version they were scored under.
 */
export const RUBRIC_VERSION = "0.1";

export const RUBRIC_WEIGHTS = {
  employment: 30,
  income: 25,
  guarantor: 20,
  documents: 15,
  reference: 10,
} as const;

export const SCORE_THRESHOLDS = {
  approveAt: 75,
  reviewAt: 50,
} as const;

export type ScoreComponent = keyof typeof RUBRIC_WEIGHTS;
