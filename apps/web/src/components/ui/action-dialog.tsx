"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { IconClose } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

export type ActionDialogField =
  | {
      type: "text";
      label: string;
      placeholder?: string;
      required?: boolean;
      multiline?: boolean;
      defaultValue?: string;
    }
  | {
      type: "date";
      label: string;
      required?: boolean;
      defaultValue?: string;
    };

type ActionDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  field?: ActionDialogField;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
  onClose: () => void;
  /** Called with the field value, or an empty string when there is no field. */
  onConfirm: (value: string) => void;
};

export function ActionDialog({
  open,
  title,
  description,
  field,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onClose,
  onConfirm,
}: ActionDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) {
      setValue("");
      return;
    }
    if (field?.defaultValue) {
      setValue(field.defaultValue);
    } else if (field?.type === "date") {
      setValue(new Date().toISOString().slice(0, 10));
    } else {
      setValue("");
    }
  }, [open, field?.defaultValue, field?.type]);

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

  if (!open) return null;

  const submit = () => {
    const trimmed = value.trim();
    if (field?.required && !trimmed) return;
    onConfirm(field ? trimmed : "");
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
        aria-describedby={description ? descId : undefined}
        className="relative w-full max-w-md rounded-[var(--radius-panel)] border border-border bg-card p-6 shadow-[0_8px_32px_rgba(10,10,15,0.12)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="m-0 font-heading text-lg font-bold text-ink">{title}</h2>
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
        {description ? (
          <p id={descId} className="mt-2 text-sm text-muted">{description}</p>
        ) : null}
        {field ? (
          <div className="mt-4">
            <Label required={field.required}>{field.label}</Label>
            {field.type === "date" ? (
              <Input
                className="mt-1"
                type="date"
                value={value}
                disabled={loading}
                onChange={(event) => setValue(event.target.value)}
              />
            ) : field.multiline ? (
              <Textarea
                className="mt-1"
                rows={3}
                value={value}
                placeholder={field.placeholder}
                disabled={loading}
                onChange={(event) => setValue(event.target.value)}
              />
            ) : (
              <Input
                className="mt-1"
                value={value}
                placeholder={field.placeholder}
                disabled={loading}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
          </div>
        ) : null}
        <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", field || description ? "mt-6" : "mt-4")}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            loading={loading}
            loadingLabel="Please wait…"
            disabled={Boolean(field?.required && !value.trim())}
            onClick={submit}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
