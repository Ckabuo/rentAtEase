"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { IconEye, IconLock } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, toastApiError } from "@/lib/api";
import { toast } from "@/lib/toast";

type Detail = {
  id: string;
  applicant: string;
  property: string;
  unit: string;
  score: number | null;
  recommendation: string | null;
  status: string;
  note: string | null;
  breakdown: Record<string, number> | null;
  declared: { employmentStatus: string; monthlyIncomeKobo: number; idNumber: string | null; reference: string };
};

const FINAL_APPLICATION_STATUSES = new Set(["APPROVED", "DECLINED"]);

function applicationStatusLabel(status: string): string {
  if (status === "INFO_REQUESTED") return "Information requested";
  if (status === "SUBMITTED") return "Pending review";
  if (status === "APPROVED") return "Approved";
  if (status === "DECLINED") return "Declined";
  if (status === "WITHDRAWN") return "Withdrawn";
  if (status === "EXPIRED") return "Expired";
  return status.replaceAll("_", " ").toLowerCase();
}

function maskedIdLabel(masked: string): string {
  const tail = masked.slice(-4);
  return tail.length === 4 ? `*****${tail}` : masked;
}

export default function ApplicationReviewPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [note, setNote] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [whatsapp, setWhatsapp] = useState(false);
  const [fullId, setFullId] = useState<string | null>(null);
  const [idVisible, setIdVisible] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<
    "APPROVE" | "REQUEST_INFORMATION" | "DECLINE" | null
  >(null);

  useEffect(() => {
    void api<Detail>(`/applications/${params.id}`)
      .then(setDetail)
      .catch((caught: unknown) => {
        setLoadFailed(true);
        toastApiError(caught, "Could not load this application.");
      });
  }, [params.id]);

  const decide = (decision: "APPROVE" | "REQUEST_INFORMATION" | "DECLINE") => {
    if (pendingDecision) return;
    setPendingDecision(decision);
    void api(`/applications/${params.id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, note, leaseStartDate: decision === "APPROVE" ? start : undefined, whatsappConsent: whatsapp }),
    })
      .then(() => toast.success(decision === "APPROVE" ? "Approved and enrolled." : "Decision saved."))
      .then(() => api<Detail>(`/applications/${params.id}`))
      .then((updated) => setDetail(updated))
      .catch((caught: unknown) => toastApiError(caught, "Decision failed."))
      .finally(() => setPendingDecision(null));
  };

  const toggleIdVisibility = () => {
    const masked = detail?.declared.idNumber;
    if (!masked) return;
    if (idVisible) {
      setIdVisible(false);
      return;
    }
    if (fullId) {
      setIdVisible(true);
      return;
    }
    setRevealLoading(true);
    void api<{ idNumber: string }>(`/applications/${params.id}/reveal`, { method: "POST" })
      .then((result) => {
        setFullId(result.idNumber);
        setIdVisible(true);
      })
      .catch((caught: unknown) => toastApiError(caught, "The ID could not be revealed."))
      .finally(() => setRevealLoading(false));
  };

  if (!detail) {
    return (
      <PortalShell title="Application">
        <p className="text-sm text-muted">{loadFailed ? "Could not load this application." : "Loading…"}</p>
      </PortalShell>
    );
  }

  const canDecide = !FINAL_APPLICATION_STATUSES.has(detail.status);

  return (
    <PortalShell title={detail.applicant}>
      <Card>
        <CardTitle>{detail.score ?? "—"} · {detail.recommendation ?? "Review"}</CardTitle>
        <CardDescription>{detail.property} · {detail.unit} · {detail.status}. This score is declared, not verified.</CardDescription>
        <ul className="mt-4 space-y-1 text-sm">
          {detail.breakdown ? Object.entries(detail.breakdown).map(([key, value]) => <li key={key}>{key}: {value}</li>) : null}
          <li>Employment: {detail.declared.employmentStatus}</li>
          <li className="flex flex-wrap items-center gap-2">
            <span>ID number:</span>
            {detail.declared.idNumber ? (
              <>
                <span className="font-mono tabular-nums tracking-wide">
                  {idVisible && fullId ? fullId : maskedIdLabel(detail.declared.idNumber)}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-control p-1 text-primary transition-colors hover:bg-teal-light disabled:opacity-50"
                  onClick={toggleIdVisibility}
                  disabled={revealLoading}
                  aria-label={idVisible ? "Hide ID number" : "Show ID number"}
                >
                  {revealLoading ? (
                    <Spinner size="sm" tone="primary" />
                  ) : idVisible ? (
                    <IconLock className="size-4" />
                  ) : (
                    <IconEye className="size-4" />
                  )}
                </button>
              </>
            ) : (
              <span>Not provided</span>
            )}
          </li>
        </ul>
        <div className="mt-4 space-y-3">
          {canDecide ? (
            <>
              <label className="block"><Label>Note</Label><Input className="mt-1" value={note} onChange={(event) => setNote(event.target.value)} /></label>
              <label className="block"><Label>Lease start if approved</Label><Input className="mt-1" type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={whatsapp} onChange={(event) => setWhatsapp(event.target.checked)} /> Tenant agrees to WhatsApp</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  loading={pendingDecision === "APPROVE"}
                  disabled={pendingDecision !== null && pendingDecision !== "APPROVE"}
                  onClick={() => decide("APPROVE")}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  loading={pendingDecision === "REQUEST_INFORMATION"}
                  disabled={pendingDecision !== null && pendingDecision !== "REQUEST_INFORMATION"}
                  onClick={() => decide("REQUEST_INFORMATION")}
                >
                  Request information
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  loading={pendingDecision === "DECLINE"}
                  disabled={pendingDecision !== null && pendingDecision !== "DECLINE"}
                  onClick={() => decide("DECLINE")}
                >
                  Decline
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-control border border-border bg-canvas px-4 py-3 text-sm">
              <p className="font-bold text-ink">Decision recorded</p>
              <p className="mt-1 text-muted">{applicationStatusLabel(detail.status)}</p>
              {detail.note ? <p className="mt-2 text-ink">{detail.note}</p> : null}
              <p className="mt-2 text-xs text-muted">This application can no longer be changed from here.</p>
            </div>
          )}
        </div>
      </Card>
    </PortalShell>
  );
}
