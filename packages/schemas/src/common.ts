import { NIGERIAN_PHONE_PATTERN, toLocalNigerianPhone } from "@rae/domain";
import { z } from "zod";

export const koboSchema = z.number().int();
export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const personNameSchema = z.string().trim().min(1).max(120);

const nigerianPhoneDigits = z
  .string()
  .length(11, "Phone number must be 11 digits (e.g. 08030000000).")
  .regex(NIGERIAN_PHONE_PATTERN, "Enter a valid Nigerian mobile number.");

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => toLocalNigerianPhone(value))
  .pipe(nigerianPhoneDigits);

export const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return undefined;
    return toLocalNigerianPhone(value);
  })
  .pipe(z.union([z.undefined(), nigerianPhoneDigits]));
