"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { UploadedApplyDocument } from "@/lib/apply-form";
import { uploadApplyDocument } from "@/lib/apply-upload";

type DocumentUploadZoneProps = {
  applyToken: string;
  kind: UploadedApplyDocument["kind"];
  label: string;
  hint: string;
  document: UploadedApplyDocument | null;
  onUploaded: (document: UploadedApplyDocument | null) => void;
};

export function DocumentUploadZone({
  applyToken,
  kind,
  label,
  hint,
  document,
  onUploaded,
}: DocumentUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    void uploadApplyDocument(applyToken, kind, file)
      .then(onUploaded)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Upload failed.");
      })
      .finally(() => setUploading(false));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {document ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-teal-light px-3 py-2 text-sm">
          <span className="font-medium text-primary">{document.fileName}</span>
          <Button type="button" variant="ghost" onClick={() => onUploaded(null)}>
            Remove
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            "w-full rounded-control border-2 border-dashed border-border bg-cream px-4 py-5 text-center transition-colors",
            "hover:border-primary hover:bg-teal-light",
            uploading && "pointer-events-none opacity-70",
          )}
          onClick={pick}
          disabled={uploading}
        >
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="mt-1 text-xs text-muted">{hint}</p>
          <p className="mt-2 text-xs font-semibold text-primary">{uploading ? "Uploading…" : "Click to upload"}</p>
        </button>
      )}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
