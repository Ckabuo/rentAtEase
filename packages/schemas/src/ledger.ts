import { PAYMENT_CATEGORIES, PAYMENT_METHODS } from "@rae/domain";
import { z } from "zod";
import { calendarDateSchema, koboSchema } from "./common";

export const recordPaymentSchema = z.object({
  tenancyId: z.string().min(1),
  amountKobo: koboSchema.positive(),
  paidOn: calendarDateSchema,
  method: z.enum(PAYMENT_METHODS),
  category: z.enum(PAYMENT_CATEGORIES),
  idempotencyKey: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
  acknowledgeDuplicate: z.boolean().optional(),
});

export const replacementPaymentSchema = recordPaymentSchema.omit({ tenancyId: true });

export const voidReceiptSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  replacement: replacementPaymentSchema.optional(),
});

export type RecordPayment = z.infer<typeof recordPaymentSchema>;
export type VoidReceipt = z.infer<typeof voidReceiptSchema>;
