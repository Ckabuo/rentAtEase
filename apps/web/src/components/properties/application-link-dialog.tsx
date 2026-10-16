"use client";

import { useEffect, useId, useRef } from "react";
import { IconClose } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

type ApplicationLinkDialogProps = {
  open: boolean;
  loading?: boolean;
  url?: string;
  propertyName?: string;
  unitLabel?: string;
  onClose: () => void;
};

export function ApplicationLinkDialog({
  open,
  loading = false,
  url,
  propertyName,
  unitLabel,
  onClose,
}: ApplicationLinkDialogProps) {
  const titleId = useId();
  const descId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loading, onClose]);

  useEffect(() => {
    if (open && url && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [open, url]);

  if (!open) return null;

  const unitLine = propertyName && unitLabel ? `${propertyName} · ${unitLabel}` : propertyName ?? unitLabel;

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied. Send it to your applicant.");
    } catch {
      inputRef.current?.select();
      toast.error("Could not copy automatically. Select the link and copy it manually.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/50"
        aria-label="Close dialog"
        onClick={loading ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-lg rounded-[var(--radius-panel)] border border-border bg-card p-6 shadow-[0_8px_32px_rgba(10,10,15,0.12)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="m-0 font-heading text-lg font-bold text-ink">Share application link</h2>
          <button
            type="button"
            className="rounded-control p-1 text-muted hover:bg-cream hover:text-ink"
            aria-label="Close"
            disabled={loading}
            onClick={onClose}
          >
            <IconClose className="size-5" />
          </button>
        </div>
        <p id={descId} className="mt-2 text-sm text-muted">
          {loading
            ? "Generating a link for this vacant unit…"
            : unitLine
              ? `Send this link to your applicant for ${unitLine}. They will complete pre-qualification on their own phone or computer`
              : "Send this link to your applicant. They will complete pre-qualification on their own device."}
        </p>
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-muted" role="status">Please wait…</p>
          ) : url ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input ref={inputRef} className="min-w-0 flex-1 font-mono text-xs sm:text-sm" readOnly value={url} aria-label="Application link" />
              <Button type="button" className="shrink-0" onClick={() => void copyLink()}>
                Copy link
              </Button>
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
