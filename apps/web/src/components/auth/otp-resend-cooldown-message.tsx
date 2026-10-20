"use client";

import { useResendCountdown } from "@/hooks/use-resend-countdown";

type OtpResendCooldownMessageProps = {
  resendAvailableAt: string;
  className?: string;
};

export function OtpResendCooldownMessage({ resendAvailableAt, className }: OtpResendCooldownMessageProps) {
  const secondsLeft = useResendCountdown(resendAvailableAt);
  if (secondsLeft <= 0) return null;

  return (
    <p className={className} role="status">
      Resend available in {secondsLeft}s.
    </p>
  );
}
