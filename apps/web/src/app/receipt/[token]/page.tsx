"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatNaira } from "@rae/domain";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api, apiBase, toastApiError } from "@/lib/api";
import { toast } from "@/lib/toast";

type Receipt = { found: boolean; number?: string; status?: string; amountKobo?: number; tenant?: string; unit?: string; property?: string };

export default function ReceiptRespondPage() {
  const params = useParams<{ token: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeBusy, setDisputeBusy] = useState(false);

  useEffect(() => {
    void api<Receipt>(`/public/receipts/${params.token}`)
      .then(setReceipt)
      .catch((caught: unknown) => {
        setReceipt({ found: false });
        setLinkInvalid(true);
        toastApiError(caught, "This receipt link is not valid.");
      });
  }, [params.token]);

  const submitDispute = (note: string) => {
    if (!note.trim()) return;
    setDisputeBusy(true);
    void api(`/public/receipts/${params.token}/dispute`, { method: "POST", body: JSON.stringify({ note: note.trim() }) })
      .then(() => {
        setDisputeOpen(false);
        toast.success("Your note was sent to the landlord.");
      })
      .catch((caught: unknown) => toastApiError(caught, "The note was not sent."))
      .finally(() => setDisputeBusy(false));
  };

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-canvas px-4 py-10">
      <Card>
        <CardTitle>{receipt?.number ?? "Receipt"}</CardTitle>
        <CardDescription>
          {linkInvalid
            ? "This receipt link is not valid."
            : receipt?.found
              ? `${receipt.tenant}, ${receipt.unit} at ${receipt.property}. ${formatNaira(receipt.amountKobo ?? 0)}. Status: ${receipt.status}.`
              : "Loading receipt…"}
        </CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => window.open(`${apiBase()}/api/public/receipts/${params.token}/file`, "_blank")}>Download PDF</Button>
          <Button
            type="button"
            onClick={() =>
              void api(`/public/receipts/${params.token}/confirm`, { method: "POST" })
                .then(() => toast.success("Thanks, the landlord can see that you confirmed this receipt."))
                .catch((caught: unknown) => toastApiError(caught, "Confirmation was not saved."))
            }
          >
            Confirm
          </Button>
          <Button type="button" variant="danger" onClick={() => setDisputeOpen(true)}>Dispute</Button>
        </div>
      </Card>

      <ActionDialog
        open={disputeOpen}
        title="Dispute this receipt"
        description="Tell the landlord what does not look right. This is not a legal filing — it sends them a note."
        field={{
          type: "text",
          label: "Your message",
          placeholder: "What should the landlord know?",
          required: true,
          multiline: true,
        }}
        confirmLabel="Send note"
        variant="danger"
        loading={disputeBusy}
        onClose={() => {
          if (!disputeBusy) setDisputeOpen(false);
        }}
        onConfirm={submitDispute}
      />
    </main>
  );
}
