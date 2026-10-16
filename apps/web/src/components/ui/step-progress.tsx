import { cn } from "@/lib/cn";

type StepProgressProps = {
  current: number;
  total: number;
  labels?: string[];
};

export function StepProgress({ current, total, labels }: StepProgressProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-muted">
        <span>
          Step {current} of {total}
        </span>
        {labels?.[current - 1] ? <span className="truncate text-ink">{labels[current - 1]}</span> : null}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${current} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
