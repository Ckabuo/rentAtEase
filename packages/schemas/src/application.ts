import { APPLICATION_DECISIONS, REFERENCE_STANDINGS, RENT_CYCLES } from "@rae/domain";
import { z } from "zod";
import { calendarDateSchema, koboSchema, optionalPhoneSchema, personNameSchema, phoneSchema } from "./common";

export const applicationConsentSchema = z.object({
  isAdult: z.literal(true),
  acceptedNotice: z.literal(true),
  noticeVersion: z.string().min(1),
  guarantorPermission: z.literal(true),
});

export const submitApplicationSchema = z.object({
  unitId: z.string().min(1),
  fullName: personNameSchema,
  phone: phoneSchema,
  email: z.email().optional(),
  consent: applicationConsentSchema,
  employmentStatus: z.string().trim().min(1).max(80),
  yearsInCurrentJob: z.number().int().nonnegative().nullable(),
  monthlyIncomeKobo: koboSchema.nonnegative(),
  incomeSource: z.string().trim().min(1).max(80),
  affordableRentKobo: koboSchema.nonnegative(),
  rentCycle: z.enum(RENT_CYCLES),
  guarantorName: personNameSchema.optional(),
  guarantorPhone: optionalPhoneSchema,
  guarantorWillSign: z.boolean(),
  guarantorEmployment: z.string().trim().max(80).optional(),
  nextOfKinName: personNameSchema.optional(),
  nextOfKinPhone: optionalPhoneSchema,
  idType: z.string().trim().max(40).optional(),
  idNumber: z.string().trim().max(40).optional(),
  reference: z.enum(REFERENCE_STANDINGS),
  documents: z
    .array(
      z.object({
        kind: z.enum(["ID", "PROOF_OF_INCOME"]),
        storageKey: z.string().min(1).max(240),
        contentType: z.string().min(1).max(80),
        sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .max(4)
    .optional(),
});

export const applicationDecisionSchema = z.object({
  decision: z.enum(APPLICATION_DECISIONS),
  note: z.string().trim().max(1000).optional(),
  leaseStartDate: calendarDateSchema.optional(),
  whatsappConsent: z.boolean().optional(),
});

export type SubmitApplication = z.infer<typeof submitApplicationSchema>;
export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>;
