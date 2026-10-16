import { RENT_CYCLES } from "@rae/domain";
import { z } from "zod";
import { calendarDateSchema, koboSchema, personNameSchema, phoneSchema } from "./common";

export const createTenantSchema = z.object({
  fullName: personNameSchema,
  phone: phoneSchema,
  email: z.email().optional(),
  whatsappConsent: z.boolean(),
});

export const updateTenantSchema = z.object({
  fullName: personNameSchema,
  phone: phoneSchema,
  email: z.email().optional().nullable(),
  whatsappConsent: z.boolean(),
});

export const createTenancySchema = z.object({
  tenantId: z.string().min(1),
  unitId: z.string().min(1),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema.optional(),
  cycle: z.enum(RENT_CYCLES),
  rentAmountKobo: koboSchema.positive(),
  paidThrough: calendarDateSchema.optional(),
  openingArrearsKobo: koboSchema.nonnegative().default(0),
});

export const moveOutSchema = z.object({
  endDate: calendarDateSchema,
});

export type CreateTenant = z.infer<typeof createTenantSchema>;
export type UpdateTenant = z.infer<typeof updateTenantSchema>;
export type CreateTenancy = z.infer<typeof createTenancySchema>;
export type MoveOut = z.infer<typeof moveOutSchema>;
