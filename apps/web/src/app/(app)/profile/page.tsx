"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { ContactLinkField } from "@/components/profile/contact-link-field";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountMe } from "@/lib/account-types";
import { api, toastApiError } from "@/lib/api";
import { markSignedIn } from "@/lib/auth-session";
import { toast } from "@/lib/toast";
import type { OnboardingProfile } from "@/lib/onboarding-storage";

const roleLabels: Record<OnboardingProfile["role"], string> = {
  owner: "Property owner",
  manager: "Property manager",
  agent: "Agent or estate surveyor",
  caretaker: "Caretaker",
};

const challengeLabels: Record<string, string> = {
  late: "Tenants paying late",
  screening: "Choosing reliable tenants",
  records: "Keeping accurate records",
};

const firstActionLabels: Record<string, string> = {
  property: "Add properties and units",
  tenants: "Add existing tenants",
  application: "Share an application link",
};

function formatOnboarding(onboarding: OnboardingProfile | null): { label: string; value: string }[] {
  if (!onboarding) return [];
  const rows: { label: string; value: string }[] = [];
  if (onboarding.role) rows.push({ label: "Role", value: roleLabels[onboarding.role] ?? onboarding.role });
  if (onboarding.unitBand) rows.push({ label: "Portfolio size", value: `${onboarding.unitBand} units` });
  if (onboarding.rentCycles?.length) rows.push({ label: "Rent cycles", value: onboarding.rentCycles.join(", ") });
  if (onboarding.topChallenge) {
    rows.push({ label: "Top challenge", value: challengeLabels[onboarding.topChallenge] ?? onboarding.topChallenge });
  }
  if (onboarding.firstAction) {
    rows.push({ label: "First priority", value: firstActionLabels[onboarding.firstAction] ?? onboarding.firstAction });
  }
  if (onboarding.whatsappReminders) {
    rows.push({
      label: "WhatsApp reminders",
      value: onboarding.whatsappReminders === "yes" ? "Yes, when tenants agree" : "Not yet",
    });
  }
  return rows;
}

export default function ProfilePage() {
  const [me, setMe] = useState<AccountMe | null>(null);
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api<AccountMe>("/accounts/me")
      .then((data) => {
        setMe(data);
        setName(data.user.name);
        setBusinessName(data.account.name);
      })
      .catch((caught: unknown) => toastApiError(caught, "Could not load profile."));
  }, []);

  const isOwner = me?.role === "OWNER";
  const onboardingRows = formatOnboarding(me?.account.onboarding ?? null);

  const saveProfile = () => {
    const trimmedName = name.trim();
    const trimmedBusiness = businessName.trim();
    if (!trimmedName) {
      toast.error("Your name is required.");
      return;
    }
    setSaving(true);
    void (async () => {
      try {
        const body: { name?: string; businessName?: string } = {};
        if (trimmedName !== me?.user.name) body.name = trimmedName;
        if (isOwner && trimmedBusiness && trimmedBusiness !== me?.account.name) body.businessName = trimmedBusiness;
        if (!body.name && !body.businessName) {
          toast.message("No changes to save.");
          setSaving(false);
          return;
        }
        const updated = await api<AccountMe>("/accounts/me", { method: "PATCH", body: JSON.stringify(body) });
        setMe(updated);
        setName(updated.user.name);
        setBusinessName(updated.account.name);
        markSignedIn(updated.user.name);
        toast.success("Profile saved.");
      } catch (caught) {
        toastApiError(caught, "Profile could not be saved.");
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <PortalShell title="Profile" planLabel={me?.plan.name} userName={me?.user.name}>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="lg">
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            Update how you appear in the app. Add phone and email so you can sign in with either next time.
          </CardDescription>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="profile-name" required>Your name</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            {isOwner ? (
              <div>
                <Label htmlFor="profile-business">Workspace / portfolio name</Label>
                <Input
                  id="profile-business"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted">Workspace name can only be changed by the account owner.</p>
            )}
            <Button type="button" onClick={saveProfile} loading={saving} loadingLabel="Saving…" disabled={!me}>
              Save changes
            </Button>
          </div>

          <div className="mt-8 space-y-4">
            <ContactLinkField
              channel="SMS"
              label="Phone number"
              currentValue={me?.user.phone ?? null}
              placeholder="e.g. 08012345678"
              readOnly
              onLinked={(updated) => {
                setMe(updated);
                toast.success("Phone number linked. You can sign in with it next time.");
              }}
              onError={(message) => {
                if (message) toast.error(message);
              }}
            />
            <ContactLinkField
              channel="EMAIL"
              label="Email"
              currentValue={me?.user.email ?? null}
              placeholder="you@example.com"
              readOnly
              onLinked={(updated) => {
                setMe(updated);
                toast.success("Email linked. You can sign in with it next time.");
              }}
              onError={(message) => {
                if (message) toast.error(message);
              }}
            />
          </div>
        </Card>

        <Card padding="lg">
          <CardTitle>Plan & setup</CardTitle>
          <CardDescription>
            {me?.plan.name ?? "Starter"} plan
            {me ? ` · ${me.usage.units}${me.plan.unitLimit ? ` of ${me.plan.unitLimit}` : ""} units` : ""}
          </CardDescription>
          {onboardingRows.length ? (
            <dl className="mt-5 space-y-3 text-sm">
              {onboardingRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="font-medium text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-5 text-sm text-muted">Complete onboarding to see your setup preferences here.</p>
          )}
        </Card>
      </div>
    </PortalShell>
  );
}
