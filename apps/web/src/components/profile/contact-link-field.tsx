"use client";

import { OTP_CODE_TTL_SECONDS } from "@rae/domain";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidNigerianPhone } from "@rae/domain";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { useResendCountdown } from "@/hooks/use-resend-countdown";
import type { AccountMe } from "@/lib/account-types";
import { api, apiErrorMessage } from "@/lib/api";
import { applyOtpRequestResponse, type OtpRequestResponse } from "@/lib/otp-request";

type ContactLinkFieldProps = {
  channel: "SMS" | "EMAIL";
  label: string;
  currentValue: string | null;
  placeholder: string;
  onLinked: (me: AccountMe) => void;
  onError: (message: string) => void;
  /** When true, show linked contact only (no add/change flow). */
  readOnly?: boolean;
};

export function ContactLinkField({
  channel,
  label,
  currentValue,
  placeholder,
  onLinked,
  onError,
  readOnly = false,
}: ContactLinkFieldProps) {
  const [draft, setDraft] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"idle" | "verify">("idle");
  const [pendingDestination, setPendingDestination] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const resendSecondsLeft = useResendCountdown(resendAvailableAt);

  const requestCode = () => {
    const destination = draft.trim();
    if (!destination) {
      onError(`Enter a ${label.toLowerCase()} to verify.`);
      return;
    }
    if (channel === "SMS" && !isValidNigerianPhone(destination)) {
      onError("Enter an 11-digit Nigerian phone number (e.g. 08030000000).");
      return;
    }
    setLoading(true);
    onError("");
    void (async () => {
      try {
        const result = await api<OtpRequestResponse>("/auth/otp/request", {
          method: "POST",
          body: JSON.stringify({ channel, destination }),
        });
        applyOtpRequestResponse(result);
        setResendAvailableAt(result.resendAvailableAt);
        setPendingDestination(destination);
        setStep("verify");
        setCode("");
        if (result.devCode) sessionStorage.setItem("rae.signIn.devCode", result.devCode);
      } catch (caught) {
        onError(apiErrorMessage(caught, "The code could not be sent."));
      } finally {
        setLoading(false);
      }
    })();
  };

  const verify = () => {
    if (code.length !== 6) return;
    setLoading(true);
    onError("");
    void (async () => {
      try {
        const me = await api<AccountMe>("/accounts/me/contact", {
          method: "POST",
          body: JSON.stringify({ channel, destination: pendingDestination, code }),
        });
        sessionStorage.removeItem("rae.signIn.devCode");
        setStep("idle");
        setDraft("");
        setCode("");
        onLinked(me);
      } catch (caught) {
        onError(apiErrorMessage(caught, "Verification failed."));
      } finally {
        setLoading(false);
      }
    })();
  };

  const resend = () => {
    if (resendSecondsLeft > 0 || !pendingDestination) return;
    setLoading(true);
    void (async () => {
      try {
        const result = await api<OtpRequestResponse>("/auth/otp/request", {
          method: "POST",
          body: JSON.stringify({ channel, destination: pendingDestination }),
        });
        applyOtpRequestResponse(result);
        setResendAvailableAt(result.resendAvailableAt);
        if (result.devCode) sessionStorage.setItem("rae.signIn.devCode", result.devCode);
      } catch (caught) {
        onError(apiErrorMessage(caught, "Could not resend the code."));
      } finally {
        setLoading(false);
      }
    })();
  };

  const devCode =
    typeof window !== "undefined" && step === "verify" ? sessionStorage.getItem("rae.signIn.devCode") : null;

  return (
    <div className="rounded-control border border-border bg-cream/50 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label>{label}</Label>
          <p className="mt-0.5 text-sm font-medium text-ink">{currentValue ?? "Not added"}</p>
        </div>
        {currentValue ? (
          <span className="rounded-full border border-success/40 bg-success-light px-2 py-0.5 text-[0.65rem] font-bold text-success">
            Verified
          </span>
        ) : null}
      </div>

      {readOnly && currentValue ? null : step === "idle" ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            {channel === "SMS" ? (
              <PhoneInput value={draft} onChange={setDraft} placeholder={placeholder} />
            ) : (
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                autoComplete="email"
              />
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={loading}
            loadingLabel="Sending…"
            onClick={requestCode}
          >
            {currentValue ? "Change" : "Add & verify"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted">
            Enter the 6-digit code sent to <span className="font-semibold text-ink">{pendingDestination}</span>.
            {devCode ? (
              <span className="mt-1 block text-xs text-primary">Dev code: {devCode}</span>
            ) : null}
          </p>
          <OtpInput value={code} onChange={setCode} disabled={loading} />
          <p className="text-xs text-muted">Code expires in {Math.floor(OTP_CODE_TTL_SECONDS / 60)} minutes.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" loading={loading} loadingLabel="Verifying…" disabled={code.length !== 6} onClick={verify}>
              Confirm
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading || resendSecondsLeft > 0}
              onClick={resend}
            >
              {resendSecondsLeft > 0 ? `Resend in ${resendSecondsLeft}s` : "Resend code"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => {
                setStep("idle");
                setCode("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
