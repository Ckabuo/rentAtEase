export const OTP_CODE_TTL_SECONDS = 5 * 60;
/** Rolling window for counting sends when applying progressive resend backoff. */
export const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;

export type OtpChannel = "SMS" | "EMAIL";

/**
 * Seconds to wait after the Nth code was sent before another resend is allowed.
 * N=1: initial channel delay (30s SMS, 60s email). Then 60s, then 120s (capped).
 */
export function resendCooldownSeconds(codesAlreadySent: number, channel: OtpChannel): number {
  if (codesAlreadySent <= 0) return 0;
  if (codesAlreadySent === 1) return channel === "SMS" ? 30 : 60;
  if (codesAlreadySent === 2) return 60;
  return 120;
}

export function nextResendAt(lastSentAt: Date, codesAlreadySent: number, channel: OtpChannel): Date {
  const delayMs = resendCooldownSeconds(codesAlreadySent, channel) * 1000;
  return new Date(lastSentAt.getTime() + delayMs);
}

export function secondsUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000));
}
