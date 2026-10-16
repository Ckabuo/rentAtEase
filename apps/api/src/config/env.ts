const REQUIRED = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;

/** Fails startup with the variable names only — never prints secret values. */
export function assertRequiredEnv(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Copy .env.example to .env and set them before starting the API.`,
    );
  }
  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    if ((process.env[key] ?? "").trim().length < 32) {
      throw new Error(`${key} must be at least 32 characters. Generate a long random string and put it in .env.`);
    }
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export type OtpDelivery = "log" | "termii" | "infobip" | "whatsapp";

export function otpDelivery(): OtpDelivery {
  const raw = (process.env.OTP_DELIVERY ?? "").trim().toLowerCase();
  if (raw === "log" || raw === "termii" || raw === "infobip" || raw === "whatsapp") {
    if (raw === "log" && isProduction()) {
      throw new Error("OTP_DELIVERY=log is not allowed when NODE_ENV=production. Use termii, infobip, or whatsapp.");
    }
    return raw;
  }
  if (raw) {
    throw new Error(`OTP_DELIVERY must be log, termii, infobip, or whatsapp.`);
  }
  if (isProduction()) {
    throw new Error("Set OTP_DELIVERY to termii, infobip, or whatsapp before requesting a sign-in code.");
  }
  return "log";
}

export function whatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
}

export function s3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET?.trim() &&
      process.env.S3_REGION?.trim() &&
      process.env.S3_ACCESS_KEY_ID?.trim() &&
      process.env.S3_SECRET_ACCESS_KEY?.trim(),
  );
}

export function apiPublicUrl(): string {
  return (process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`).replace(/\/$/, "");
}

export function webOrigin(): string {
  return (process.env.WEB_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
}
