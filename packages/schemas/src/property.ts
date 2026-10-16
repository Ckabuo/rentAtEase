import { UNIT_TYPES, RENT_CYCLES } from "@rae/domain";
import { z } from "zod";
import { calendarDateSchema, koboSchema } from "./common";

export const createPropertySchema = z.object({
  name: z.string().trim().min(1).max(160),
  addressLine: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export const createUnitSchema = z.object({
  propertyId: z.string().min(1),
  label: z.string().trim().min(1).max(80),
  type: z.enum(UNIT_TYPES),
  rentAmountKobo: koboSchema.positive(),
  cycle: z.enum(RENT_CYCLES),
  effectiveFrom: calendarDateSchema,
});

export const updatePropertySchema = createPropertySchema.extend({
  description: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
});

export type CreateProperty = z.infer<typeof createPropertySchema>;
export type UpdateProperty = z.infer<typeof updatePropertySchema>;
export type CreateUnit = z.infer<typeof createUnitSchema>;
