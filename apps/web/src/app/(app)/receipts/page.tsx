"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@rae/domain";
import { PortalShell } from "@/components/layout/portal-shell";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { api, apiBase, readToken, redirectToSignIn, toastApiError } from "@/lib/api";
import { displayDate } from "@/lib/display-date";
import { toast } from "@/lib/toast";

type Receipt = { id: string; number: string; status: string; amountKobo: number; paidOn: string; tenant: string; unit: string; publicPath: string };

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [voidTarget, setVoidTarget] = useState<Receipt | null>(null);
  const [voidBusy, setVoidBusy] = useState(false);

  const load = () => {
    void api<Receipt[]>("/receipts")
      .then(setReceipts)
      .catch((caught: unknown) => toastApiError(caught, "Could not load receipts."));
  };
  useEffect(load, []);

  const confirmVoid = (reason: string) => {
    if (!voidTarget || !reason.trim()) return;
    setVoidBusy(true);
    void api(`/payments/receipts/${voidTarget.id}/void`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) })
      .then(() => {
        toast.success(`${voidTarget.number} voided.`);
        setVoidTarget(null);
        load();
      })
      .catch((caught: unknown) => toastApiError(caught, "The receipt was not voided."))
      .finally(() => setVoidBusy(false));
  };

  return (
    <PortalShell title="Receipts">
      <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
        {receipts.map((receipt) => (
          <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
            <span>
              <span className="block font-semibold">{receipt.number}</span>
              <span className="text-muted">{receipt.tenant} · {receipt.unit} · {displayDate(receipt.paidOn)} · {receipt.status}</span>
            </span>
            <span className="font-display text-lg font-black">{formatNaira(receipt.amountKobo)}</span>
            <span className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => download(receipt.id)}>Download</Button>
              <Button type="button" variant="ghost" onClick={() => setVoidTarget(receipt)}>Void</Button>
            </span>
          </li>
        ))}
        {receipts.length === 0 ? <li className="px-5 py-6 text-sm text-muted">No receipts yet.</li> : null}
      </ul>
      <ActionDialog
        open={voidTarget != null}
        title={voidTarget ? `Void ${voidTarget.number}?` : ""}
        description="Explain why this receipt is being replaced. The original will be marked void."
        field={{
          type: "text",
          label: "Reason",
          placeholder: "e.g. Wrong amount recorded",
          required: true,
          multiline: true,
        }}
        confirmLabel="Void receipt"
        variant="danger"
        loading={voidBusy}
        onClose={() => {
          if (!voidBusy) setVoidTarget(null);
        }}
        onConfirm={confirmVoid}
      />
    </PortalShell>
  );
}

async function download(id: string) {
  const token = readToken();
  const response = await fetch(`${apiBase()}/api/receipts/${id}/file`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (response.status === 401) {
    redirectToSignIn();
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
