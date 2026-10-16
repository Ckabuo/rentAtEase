"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioCard } from "@/components/ui/radio-card";
import { StepProgress } from "@/components/ui/step-progress";
import { api, ApiError, toastApiError, writeToken } from "@/lib/api";
import { markSignedIn, readSignedInName } from "@/lib/auth-session";
import {
  type OnboardingProfile,
  readOnboarding,
  writeOnboarding,
} from "@/lib/onboarding-storage";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

const STEP_LABELS = ["Welcome", "About you", "Portfolio", "Rent habits", "First step"];

const defaultProfile: OnboardingProfile = {
  fullName: "",
  businessName: "",
  role: "owner",
  unitBand: "1-3",
  rentCycles: [],
  trackingToday: "notebook",
  topChallenge: "late",
  caretakers: "none",
  firstAction: "property",
  whatsappReminders: "yes",
};

function initialProfile(): OnboardingProfile {
  const saved = readOnboarding();
  const sessionName = readSignedInName();
  const base = saved ? { ...defaultProfile, ...saved } : { ...defaultProfile };
  if (sessionName && !base.fullName && !sessionName.includes("@")) {
    base.fullName = sessionName;
  }
  return base;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<OnboardingProfile>(() =>
    typeof window === "undefined" ? defaultProfile : initialProfile(),
  );
  const totalSteps = STEP_LABELS.length;

  const firstName = useMemo(() => profile.fullName.trim().split(" ")[0] || "there", [profile.fullName]);

  const toggleCycle = (cycle: string) => {
    setProfile((p) => ({
      ...p,
      rentCycles: p.rentCycles.includes(cycle)
        ? p.rentCycles.filter((c) => c !== cycle)
        : [...p.rentCycles, cycle],
    }));
  };

  const finish = (completed: boolean) => {
    const saved = { ...profile, ...(completed ? { completedAt: new Date().toISOString() } : {}) };
    const identifier = readSignedInName() ?? "";
    const email = identifier.includes("@") ? identifier : undefined;
    const name = profile.fullName.trim() || (email ? "Landlord" : identifier) || "Landlord";
    setSaving(true);
    void (async () => {
      try {
        const result = await api<{ token: string }>("/auth/onboarding", {
          method: "POST",
          body: JSON.stringify({
            profile: {
              name,
              businessName: profile.businessName.trim() || "My properties",
              phone: email ? undefined : identifier || undefined,
              email,
            },
            onboarding: saved,
          }),
        });
        writeToken(result.token);
        markSignedIn(name, result.token);
        writeOnboarding(saved);
        toast.success(completed ? "Setup complete. Welcome to Rent@Ease." : "You can finish setup anytime from your dashboard.");
        router.push("/dashboard");
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) return;
        toastApiError(caught, "Setup could not be saved.");
        setSaving(false);
      }
    })();
  };

  const next = () => {
    if (step === 2 && !profile.fullName.trim()) return;
    if (step < totalSteps) {
      setStep((s) => s + 1);
      return;
    }
    finish(true);
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-card px-4 py-4 sm:px-7">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
          <Logo href="/dashboard" />
          <button
            type="button"
            className="text-xs font-semibold text-muted hover:text-ink"
            onClick={() => finish(false)}
          >
            Skip for now
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8 sm:px-0">
        <StepProgress current={step} total={totalSteps} labels={STEP_LABELS} />

        <Card className="mt-8" padding="lg">
          {step === 1 && (
            <>
              <CardTitle>Welcome, {firstName === "there" ? "let’s get started" : firstName}</CardTitle>
              <CardDescription>
                Answer a few quick questions so we can tailor reminders and your setup checklist. About five minutes.
              </CardDescription>
              <p className="mt-6 rounded-control border border-border bg-cream px-4 py-3 text-sm text-muted">
                You’ll add properties and tenants next. Existing tenants can include paid-up-to dates so your ledger
                matches reality from day one.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <CardTitle>Who you are</CardTitle>
              <CardDescription>We use this to label your workspace and suggest the right plan.</CardDescription>
              <div className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="fullName" required>Your name</Label>
                  <Input
                    id="fullName"
                    value={profile.fullName}
                    onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <Label htmlFor="businessName">Business or portfolio name</Label>
                  <Input
                    id="businessName"
                    placeholder="Optional"
                    value={profile.businessName}
                    onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>How would you describe yourself?</Label>
                  <RadioCard
                    name="role"
                    value="owner"
                    checked={profile.role === "owner"}
                    onChange={(v) => setProfile((p) => ({ ...p, role: v as OnboardingProfile["role"] }))}
                    title="I own and manage property myself"
                  />
                  <RadioCard
                    name="role"
                    value="manager"
                    checked={profile.role === "manager"}
                    onChange={(v) => setProfile((p) => ({ ...p, role: v as OnboardingProfile["role"] }))}
                    title="I manage property for other landlords"
                  />
                  <RadioCard
                    name="role"
                    value="agent"
                    checked={profile.role === "agent"}
                    onChange={(v) => setProfile((p) => ({ ...p, role: v as OnboardingProfile["role"] }))}
                    title="Agent or estate surveyor"
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <CardTitle>Portfolio size</CardTitle>
              <CardDescription>Starter covers up to 3 units; Standard covers up to 15.</CardDescription>
              <div className="mt-6 space-y-2">
                {(
                  [
                    ["1-3", "1–3 units", "Starter plan"],
                    ["4-15", "4–15 units", "Standard plan"],
                    ["16-40", "16–40 units", "Pro or multi-manager"],
                    ["40+", "40+ units", "Talk to us about Pro"],
                  ] as const
                ).map(([value, title, description]) => (
                  <RadioCard
                    key={value}
                    name="units"
                    value={value}
                    checked={profile.unitBand === value}
                    onChange={(v) => setProfile((p) => ({ ...p, unitBand: v as OnboardingProfile["unitBand"] }))}
                    title={title}
                    description={description}
                  />
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <CardTitle>How rent works for you</CardTitle>
              <CardDescription>We’ll pre-set reminder timing from your usual cycles.</CardDescription>
              <div className="mt-6">
                <Label>Rent cycles you use</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Annual", "Every 6 months", "Monthly", "It varies"].map((cycle) => {
                    const selected = profile.rentCycles.includes(cycle);
                    return (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() => toggleCycle(cycle)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                          selected
                            ? "border-primary bg-teal-light text-primary"
                            : "border-border bg-cream text-muted hover:border-muted",
                        )}
                      >
                        {cycle}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6 space-y-2">
                <Label>Biggest headache right now</Label>
                <RadioCard
                  name="challenge"
                  value="late"
                  checked={profile.topChallenge === "late"}
                  onChange={(v) => setProfile((p) => ({ ...p, topChallenge: v }))}
                  title="Tenants paying late"
                  description="We’ll highlight automatic reminders."
                />
                <RadioCard
                  name="challenge"
                  value="screening"
                  checked={profile.topChallenge === "screening"}
                  onChange={(v) => setProfile((p) => ({ ...p, topChallenge: v }))}
                  title="Choosing reliable tenants"
                  description="We’ll surface pre-qualification first."
                />
                <RadioCard
                  name="challenge"
                  value="records"
                  checked={profile.topChallenge === "records"}
                  onChange={(v) => setProfile((p) => ({ ...p, topChallenge: v }))}
                  title="Keeping accurate records"
                  description="We’ll start with your ledger checklist."
                />
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <CardTitle>What would you like to do first?</CardTitle>
              <CardDescription>Your dashboard checklist will match this choice.</CardDescription>
              <div className="mt-6 space-y-2">
                <RadioCard
                  name="first"
                  value="property"
                  checked={profile.firstAction === "property"}
                  onChange={(v) => setProfile((p) => ({ ...p, firstAction: v }))}
                  title="Add properties and units"
                />
                <RadioCard
                  name="first"
                  value="tenants"
                  checked={profile.firstAction === "tenants"}
                  onChange={(v) => setProfile((p) => ({ ...p, firstAction: v }))}
                  title="Add existing tenants"
                />
                <RadioCard
                  name="first"
                  value="application"
                  checked={profile.firstAction === "application"}
                  onChange={(v) => setProfile((p) => ({ ...p, firstAction: v }))}
                  title="Share an application link"
                />
              </div>
              <div className="mt-6 space-y-2">
                <Label>WhatsApp reminders and receipts</Label>
                <RadioCard
                  name="wa"
                  value="yes"
                  checked={profile.whatsappReminders === "yes"}
                  onChange={(v) => setProfile((p) => ({ ...p, whatsappReminders: v as "yes" | "not_yet" }))}
                  title="Yes — once each tenant has agreed"
                />
                <RadioCard
                  name="wa"
                  value="not_yet"
                  checked={profile.whatsappReminders === "not_yet"}
                  onChange={(v) => setProfile((p) => ({ ...p, whatsappReminders: v as "yes" | "not_yet" }))}
                  title="Not yet — I’ll share receipts myself"
                />
              </div>
              <p className="mt-6 rounded-control border border-primary/30 bg-teal-light px-4 py-3 text-sm text-ink">
                You’re set. Most landlords send their first receipt in under 15 minutes once tenants are added.
              </p>
            </>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="secondary" onClick={back} disabled={step === 1 || saving} className="sm:min-w-[120px]">
              Back
            </Button>
            <Button
              type="button"
              onClick={next}
              loading={saving}
              loadingLabel="Saving…"
              disabled={step === 2 && !profile.fullName.trim()}
              className="sm:min-w-[160px]"
            >
              {step === totalSteps ? "Go to dashboard" : "Continue"}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
