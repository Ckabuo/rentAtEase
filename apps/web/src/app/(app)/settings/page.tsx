"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatNaira } from "@rae/domain";
import { PortalShell } from "@/components/layout/portal-shell";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PhoneInput } from "@/components/ui/phone-input";
import type { AccountMe } from "@/lib/account-types";
import { api, toastApiError } from "@/lib/api";
import { closeAccount } from "@/lib/close-account";
import { toast } from "@/lib/toast";

function workspacePlanBlurb(me: AccountMe): string {
  if (me.plan.code === "STARTER") {
    return "Standard and Pro add more units, caretaker access, and automatic WhatsApp receipts and reminders.";
  }
  if (me.plan.whatsappEnabled && me.integrations.whatsapp) {
    return "WhatsApp receipts and reminders are available when tenants opt in.";
  }
  return "Your plan includes WhatsApp messaging. If messages are not sending, confirm each tenant has agreed on the Tenants page.";
}

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<AccountMe | null>(null);
  const [phone, setPhone] = useState("");
  const [audit, setAudit] = useState<{ id: string; action: string; createdAt: string }[]>([]);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const isOwner = me?.role === "OWNER";

  useEffect(() => {
    void api<AccountMe>("/accounts/me")
      .then(setMe)
      .catch((caught: unknown) => toastApiError(caught, "Could not load settings."));
    void api<{ id: string; action: string; createdAt: string }[]>("/audit")
      .then(setAudit)
      .catch(() => setAudit([]));
  }, []);

  return (
    <PortalShell title="Settings" planLabel={me?.plan.name} userName={me?.user.name}>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>{me?.account.name ?? "Workspace"}</CardTitle>
          <CardDescription>
            {me?.plan.name} · {formatNaira(me?.plan.monthlyPriceKobo ?? 0)} / month · {me?.usage.units ?? 0}
            {me?.plan.unitLimit ? ` of ${me.plan.unitLimit}` : ""} units. You are the {me?.role?.toLowerCase()}.
          </CardDescription>
          {me ? <p className="mt-3 text-sm text-muted">{workspacePlanBlurb(me)}</p> : null}
          {isOwner ? (
            <div className="mt-4">
              <p className="mb-2 text-sm text-muted">
                Invite a caretaker to record payments. We send a WhatsApp message to this number; they sign in with the
                same phone within 7 days.
              </p>
              <div className="flex gap-2">
                <PhoneInput value={phone} onChange={setPhone} placeholder="08030000000" />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void api<{ message: string; whatsapp?: { sent: boolean } }>("/accounts/invitations", {
                      method: "POST",
                      body: JSON.stringify({ phone }),
                    })
                      .then((result) => {
                        if (result.whatsapp?.sent) toast.success(result.message);
                        else toast.message(result.message);
                        setPhone("");
                      })
                      .catch((caught: unknown) => toastApiError(caught, "Invite failed."));
                  }}
                >
                  Invite
                </Button>
              </div>
            </div>
          ) : null}
          {isOwner ? (
            <Button className="mt-6" type="button" variant="danger" onClick={() => setCloseOpen(true)}>
              Delete Account
            </Button>
          ) : null}
        </Card>
        <ActionDialog
          open={closeOpen}
          title="Delete account?"
          description="Your workspace will be closed and you will be signed out. Records are kept for compliance and gets deleted in 90 days but you will no longer have portal access. This cannot be undone."
          confirmLabel="Delete Account"
          variant="danger"
          loading={closing}
          onClose={() => {
            if (!closing) setCloseOpen(false);
          }}
          onConfirm={() => {
            setClosing(true);
            void closeAccount()
              .then(() => router.push("/sign-in"))
              .catch((caught: unknown) => {
                toastApiError(caught, "Could not close account.");
                setClosing(false);
              });
          }}
        />
        <Card>
          <CardTitle>Audit log</CardTitle>
          <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
            {audit.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3 border-b border-border py-2">
                <span>{entry.action.replaceAll("_", " ").toLowerCase()}</span>
                <span className="text-muted">{entry.createdAt.slice(0, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PortalShell>
  );
}
