"use client";

import { useEffect, useState } from "react";
import { formatNaira, parseWholeNairaInput } from "@rae/domain";
import { PortalShell } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, toastApiError } from "@/lib/api";
import { toast } from "@/lib/toast";

type Tenancy = { id: string; tenantName: string; unit: string; property: string; endDate: string | null };
type Preview = { summary: string; duplicateWarning: boolean; unallocatedKobo: number };

function freshPaymentForm(tenancyId = "") {
  return {
    tenancyId,
    amount: "",
    paidOn: new Date().toISOString().slice(0, 10),
    method: "BANK_TRANSFER",
    category: "RENT",
    note: "",
  };
}

export default function PaymentsPage() {
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [form, setForm] = useState(freshPaymentForm());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [acknowledge, setAcknowledge] = useState(false);

  useEffect(() => {
    void api<{ tenancies: Tenancy[] }>("/tenancies")
      .then((result) => {
        const active = result.tenancies.filter((tenancy) => !tenancy.endDate);
        setTenancies(active);
        setForm((current) => {
          const stillActive = active.some((tenancy) => tenancy.id === current.tenancyId);
          return { ...current, tenancyId: stillActive ? current.tenancyId : active[0]?.id ?? "" };
        });
      })
      .catch((caught: unknown) => toastApiError(caught, "Could not load tenancies."));
  }, []);

  const paymentPayload = (idempotencyKey: string, amountKobo: number, acknowledgeDuplicate = acknowledge) => ({
    tenancyId: form.tenancyId,
    amountKobo,
    paidOn: form.paidOn,
    method: form.method,
    category: form.category,
    idempotencyKey,
    note: form.note || undefined,
    acknowledgeDuplicate,
  });

  const parseAmountKobo = (): number | null => {
    try {
      return parseWholeNairaInput(form.amount);
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "Enter a valid amount.";
      toast.error(message);
      return null;
    }
  };

  const runPreview = () => {
    setPreview(null);
    if (!form.tenancyId) {
      toast.error("Select a tenancy.");
      return;
    }
    const amountKobo = parseAmountKobo();
    if (amountKobo === null) return;
    void api<Preview>("/payments/preview", { method: "POST", body: JSON.stringify(paymentPayload(crypto.randomUUID(), amountKobo)) })
      .then(setPreview)
      .catch((caught: unknown) => toastApiError(caught, "Preview failed."));
  };

  const confirm = () => {
    const amountKobo = parseAmountKobo();
    if (amountKobo === null) return;
    void api<{ receiptNumber: string; summary: string; whatsapp?: { sent: boolean; reason?: string } }>("/payments", {
      method: "POST",
      body: JSON.stringify(paymentPayload(crypto.randomUUID(), amountKobo, acknowledge)),
    })
      .then((result) => {
        const detail = `${result.receiptNumber}. ${result.summary}${result.whatsapp?.reason ? ` ${result.whatsapp.reason}` : ""}`;
        toast.success(detail);
        setForm(freshPaymentForm(form.tenancyId));
        setPreview(null);
        setAcknowledge(false);
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.duplicate) setAcknowledge(true);
        toastApiError(caught, "Payment was not recorded.");
      });
  };

  return (
    <PortalShell title="Record a payment">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardTitle>Payment</CardTitle>
          <CardDescription>Preview how the money applies before you confirm. A receipt is issued either way.</CardDescription>
          <div className="mt-4 space-y-3">
            <label className="block">
              <Label>Tenancy</Label>
              <select className="mt-1 w-full rounded-control border border-border bg-cream px-3 py-2" value={form.tenancyId} onChange={(event) => setForm({ ...form, tenancyId: event.target.value })}>
                {tenancies.map((tenancy) => (
                  <option key={tenancy.id} value={tenancy.id}>{tenancy.tenantName} · {tenancy.property} {tenancy.unit}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <Label>Amount (naira)</Label>
              <Input
                className="mt-1"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 550000 or 546986.30"
                value={form.amount}
                onChange={(event) => {
                  setForm({ ...form, amount: event.target.value });
                  setPreview(null);
                }}
              />
            </label>
            <label className="block"><Label>Paid on</Label><Input className="mt-1" type="date" value={form.paidOn} onChange={(event) => setForm({ ...form, paidOn: event.target.value })} /></label>
            <label className="block">
              <Label>Method</Label>
              <select className="mt-1 w-full rounded-control border border-border bg-cream px-3 py-2" value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CASH">Cash</option>
                <option value="POS">POS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="block">
              <Label>Category</Label>
              <select className="mt-1 w-full rounded-control border border-border bg-cream px-3 py-2" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                <option value="RENT">Rent</option>
                <option value="CAUTION_DEPOSIT">Caution deposit</option>
                <option value="AGENCY_FEE">Agency fee</option>
                <option value="LEGAL_FEE">Legal fee</option>
                <option value="SERVICE_CHARGE">Service charge</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            {preview ? (
              <div className="rounded-control border border-primary/30 bg-teal-light px-4 py-3 text-sm">
                <p className="font-semibold text-ink">{preview.summary}</p>
                {preview.unallocatedKobo > 0 ? <p className="mt-1">Unapplied: {formatNaira(preview.unallocatedKobo)}</p> : null}
                {preview.duplicateWarning ? <p className="mt-1 text-amber">A matching payment was recorded in the last 24 hours.</p> : null}
              </div>
            ) : null}
            {acknowledge ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={acknowledge} onChange={(event) => setAcknowledge(event.target.checked)} />
                Record it again anyway
              </label>
            ) : null}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={runPreview}>Preview</Button>
              <Button type="button" onClick={confirm} disabled={!preview}>Confirm and issue receipt</Button>
            </div>
          </div>
        </Card>
      </div>
    </PortalShell>
  );
}
