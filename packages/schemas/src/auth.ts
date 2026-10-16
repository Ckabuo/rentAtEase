import { z } from "zod";
import { personNameSchema, phoneSchema } from "./common";

export const signInChannelSchema = z.enum(["SMS", "EMAIL"]);

export const requestSignInCodeSchema = z.object({
  channel: signInChannelSchema,
  destination: z.string().trim().min(3).max(254),
});

export const verifySignInCodeSchema = z.object({
  channel: signInChannelSchema,
  destination: z.string().trim().min(3).max(254),
  code: z.string().regex(/^\d{6}$/),
});

export const signUpProfileSchema = z
  .object({
    name: personNameSchema,
    businessName: z.string().trim().min(1).max(160),
    phone: phoneSchema.optional(),
    email: z.email().optional(),
  })
  .refine((value) => value.phone !== undefined || value.email !== undefined, {
    message: "A phone number or email is required",
  });

export const updateProfileSchema = z.object({
  name: personNameSchema.optional(),
  businessName: z.string().trim().min(1).max(160).optional(),
});

export type RequestSignInCode = z.infer<typeof requestSignInCodeSchema>;
export type VerifySignInCode = z.infer<typeof verifySignInCodeSchema>;
export type SignUpProfile = z.infer<typeof signUpProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
