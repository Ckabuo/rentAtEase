"use client";

import { useEffect, type ReactNode } from "react";
import { IconClose } from "@/components/icons";
import { cn } from "@/lib/cn";

type OffCanvasProps = {
  title?: string;
  width?: string;
  onClose: () => void;
  children: ReactNode;
};

export function OffCanvas({ title, width = "max-w-[540px]", onClose, children }: OffCanvasProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed bottom-0 left-0 right-0 top-[var(--portal-header-h,4rem)] z-[55] flex items-stretch justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-ink/50"
        aria-label="Close panel"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative my-3 mr-3 flex h-[calc(100%-1.5rem)] max-h-[calc(100%-1.5rem)] w-full flex-col rounded-[var(--radius-panel)] bg-card shadow-[0_8px_32px_rgba(10,10,15,0.12),0_1.5px_4px_rgba(10,10,15,0.06)]",
          width,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "off-canvas-title" : undefined}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between rounded-t-[var(--radius-panel)] border-b border-border bg-card px-6 pb-3 pt-6">
          {title ? (
            <h2 id="off-canvas-title" className="m-0 pr-4 font-heading text-lg font-bold text-ink">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="rounded-control p-1 text-muted hover:bg-cream hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            <IconClose className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-10">{children}</div>
      </div>
    </div>
  );
}
