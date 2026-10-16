"use client";

import { cn } from "@/lib/cn";
import { APPLY_STEP_LABELS } from "@/lib/apply-form";

type ApplyStepperProps = {
  current: number;
  maxReached: number;
  onGoTo: (step: number) => void;
};

export function ApplyStepper({ current, maxReached, onGoTo }: ApplyStepperProps) {
  return (
    <div className="hidden overflow-hidden rounded-panel border border-border bg-card sm:flex">
      {APPLY_STEP_LABELS.map((label, index) => {
        const step = index + 1;
        const active = step === current;
        const done = step < current;
        const clickable = step <= maxReached;
        return (
          <button
            key={label}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onGoTo(step)}
            className={cn(
              "flex flex-1 items-center gap-2 border-r border-border px-3 py-3 text-left text-xs font-semibold last:border-r-0",
              active && "bg-primary text-white",
              done && !active && "bg-teal-light text-primary",
              !active && !done && "text-muted",
              clickable && !active && "hover:bg-cream",
              !clickable && "cursor-default opacity-60",
            )}
          >
            <span
              className={cn(
                "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold",
                active && "bg-white/25 text-white",
                done && !active && "bg-primary text-on-primary",
                !active && !done && "bg-border text-muted",
              )}
            >
              {done ? "✓" : step}
            </span>
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
