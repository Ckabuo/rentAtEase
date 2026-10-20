"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthChannelToggle } from "@/components/layout/auth-channel-toggle";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidNigerianPhone } from "@rae/domain";
import { OtpResendCooldownMessage } from "@/components/auth/otp-resend-cooldown-message";
import { api, apiErrorMessage, otpResendAvailableAt } from "@/lib/api";
import { setSignInPending, type SignInChannel } from "@/lib/auth-session";
import { applyOtpRequestResponse, type OtpRequestResponse } from "@/lib/otp-request";

export default function SignInPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<SignInChannel>("phone");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendCooldownAt, setResendCooldownAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectChannel = (value: SignInChannel) => {
    setChannel(value);
    setIdentifier("");
    setError(null);
    setResendCooldownAt(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResendCooldownAt(null);
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError(channel === "phone" ? "Enter your Nigerian phone number." : "Enter your email address.");
      return;
    }
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    if (channel === "phone" && !isValidNigerianPhone(trimmed)) {
      setError("Enter an 11-digit Nigerian phone number (e.g. 08030000000).");
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        const destination = channel === "phone" ? trimmed.replace(/\D/g, "") : trimmed;
        const result = await api<OtpRequestResponse>("/auth/otp/request", {
          method: "POST",
          body: JSON.stringify({
            channel: channel === "phone" ? "SMS" : "EMAIL",
            destination,
          }),
        });
        setSignInPending(destination, channel);
        applyOtpRequestResponse(result);
        router.push("/sign-in/verify");
      } catch (caught) {
        const cooldownAt = otpResendAvailableAt(caught);
        if (cooldownAt) {
          setResendCooldownAt(cooldownAt);
          setError(null);
        } else {
          setError(apiErrorMessage(caught, "The code could not be sent."));
        }
        setLoading(false);
      }
    })();
  };

  return (
    <AuthShell
      headerSlot={<AuthChannelToggle channel={channel} onChange={selectChannel} className="mb-8" />}
      title="Welcome back"
      subtitle="Enter your phone or email to get a one-time code. No password, no sign-up."
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <Label htmlFor="identifier" required>
            {channel === "phone" ? "Phone number" : "Email address"}
          </Label>
          {channel === "phone" ? (
            <PhoneInput id="identifier" name="identifier" value={identifier} onChange={setIdentifier} />
          ) : (
            <Input
              id="identifier"
              name="identifier"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          )}
        </div>

        {resendCooldownAt ? (
          <OtpResendCooldownMessage
            resendAvailableAt={resendCooldownAt}
            className="text-sm font-medium text-danger"
          />
        ) : error ? (
          <p className="text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" fullWidth loading={loading} loadingLabel="Sending code…">
          Send code
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted lg:text-left">
          By continuing you agree to our{" "}
          <Link href="#" className="font-semibold text-primary">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="#" className="font-semibold text-primary">
            Privacy Policy
          </Link>
          . Codes expire in 5 minutes.
        </p>
      </form>
    </AuthShell>
  );
}
