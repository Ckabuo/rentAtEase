"use client";

import { OTP_CODE_TTL_SECONDS } from "@rae/domain";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { useResendCountdown } from "@/hooks/use-resend-countdown";
import { api, ApiError, apiErrorMessage, writeToken } from "@/lib/api";
import { clearSignInPending, markSignedIn, readSignInPending } from "@/lib/auth-session";
import {
  applyOtpRequestResponse,
  readOtpRequestMeta,
  type OtpRequestMeta,
  type OtpRequestResponse,
  writeOtpRequestMeta,
} from "@/lib/otp-request";

function useSignInPending() {
  return useSyncExternalStore(
    () => () => {},
    readSignInPending,
    () => null,
  );
}

function useDevCode(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem("rae.signIn.devCode"),
    () => null,
  );
}

function defaultOtpMeta(channel: "phone" | "email"): OtpRequestMeta {
  const initialResendSec = channel === "phone" ? 30 : 60;
  const now = Date.now();
  return {
    resendAvailableAt: new Date(now + initialResendSec * 1000).toISOString(),
    codeExpiresAt: new Date(now + OTP_CODE_TTL_SECONDS * 1000).toISOString(),
  };
}

export default function VerifySignInPage() {
  const router = useRouter();
  const pending = useSignInPending();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [otpMeta, setOtpMeta] = useState<OtpRequestMeta | null>(() => readOtpRequestMeta());
  const devCode = useDevCode();
  const resendSecondsLeft = useResendCountdown(otpMeta?.resendAvailableAt ?? null);

  useEffect(() => {
    if (!pending) {
      router.replace("/sign-in");
      return;
    }
    if (!readOtpRequestMeta()) {
      const meta = defaultOtpMeta(pending.channel);
      writeOtpRequestMeta(meta);
      setOtpMeta(meta);
    }
  }, [pending, router]);

  const resend = useCallback(() => {
    if (!pending || resendSecondsLeft > 0 || resendLoading) return;
    setResendLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = await api<OtpRequestResponse>("/auth/otp/request", {
          method: "POST",
          body: JSON.stringify({
            channel: pending.channel === "phone" ? "SMS" : "EMAIL",
            destination: pending.identifier,
          }),
        });
        applyOtpRequestResponse(result);
        setOtpMeta(readOtpRequestMeta());
        setCode("");
      } catch (caught) {
        if (caught instanceof ApiError) {
          if (caught.resendAvailableAt) {
            const current = readOtpRequestMeta();
            if (current) {
              writeOtpRequestMeta({ ...current, resendAvailableAt: caught.resendAvailableAt });
              setOtpMeta(readOtpRequestMeta());
            }
          }
          setError(apiErrorMessage(caught, "The code could not be sent."));
        } else {
          setError("The code could not be sent.");
        }
      } finally {
        setResendLoading(false);
      }
    })();
  }, [pending, resendLoading, resendSecondsLeft]);

  const verify = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!pending || code.length !== 6) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const result = await api<{ token: string; needsOnboarding: boolean; user: { name: string } }>("/auth/otp/verify", {
          method: "POST",
          body: JSON.stringify({
            channel: pending.channel === "phone" ? "SMS" : "EMAIL",
            destination: pending.identifier,
            code,
          }),
        });
        writeToken(result.token);
        markSignedIn(result.user.name, result.token);
        clearSignInPending();
        sessionStorage.removeItem("rae.signIn.devCode");
        router.push(result.needsOnboarding ? "/onboarding" : "/dashboard");
      } catch (caught) {
        setError(apiErrorMessage(caught, "That code could not be checked."));
        setLoading(false);
      }
    })();
  };

  if (!pending) {
    return null;
  }

  const masked =
    pending.channel === "email"
      ? pending.identifier.replace(/(.{2})(.*)(@.*)/, "$1•••$3")
      : pending.identifier.replace(/\d(?=\d{4})/g, "•");

  const channelLabel = pending.channel === "email" ? "email" : "phone";
  const resendLabel =
    resendSecondsLeft > 0
      ? `Resend in ${resendSecondsLeft}s`
      : resendLoading
        ? "Sending…"
        : "Resend code";

  return (
    <AuthShell
      title={`Verify your ${channelLabel}`}
      subtitle={`Enter the 6-digit code we sent to ${masked}. Each code works for 5 minutes.`}
    >
      <form onSubmit={verify} className="w-full">
        {devCode ? (
          <p className="mb-5 rounded-control border border-border bg-cream px-3 py-2 text-center text-sm text-ink">
            Local delivery is on. Your code is <strong className="font-display tracking-widest">{devCode}</strong>
          </p>
        ) : null}

        <div className="mx-auto w-full max-w-[18.5rem] sm:max-w-[21.75rem]">
          <OtpInput value={code} onChange={setCode} disabled={loading} />

          <div className="mt-4 flex w-full items-center justify-between gap-3 text-sm">
            <button
              type="button"
              className="text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || resendLoading || resendSecondsLeft > 0}
              onClick={resend}
            >
              {resendLabel}
            </button>
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => router.push("/sign-in")}
            >
              Change {channelLabel}
            </button>
          </div>

          {error ? (
            <p className="mt-4 text-sm font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            fullWidth
            className="mt-6"
            loading={loading}
            loadingLabel="Verifying…"
            disabled={code.length !== 6}
          >
            Continue
          </Button>
        </div>

        <p className="mx-auto mt-8 w-full max-w-[18.5rem] text-center text-sm sm:max-w-[21.75rem]">
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
