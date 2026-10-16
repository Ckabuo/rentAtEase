import Link from "next/link";
import { cn } from "@/lib/cn";

export type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href?: string;
  actionLabel?: string;
};

type SetupChecklistProps = {
  items: ChecklistItem[];
};

export function SetupChecklist({ items }: SetupChecklistProps) {
  const completed = items.filter((item) => item.done).length;

  return (
    <section className="rounded-[var(--radius-panel)] border border-border bg-card" aria-labelledby="setup-checklist-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 id="setup-checklist-title" className="font-heading text-base font-bold text-ink">
            Get set up
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {completed} of {items.length} complete — most landlords finish in under 15 minutes.
          </p>
        </div>
        <span className="rounded-full border border-border bg-cream px-3 py-1 text-xs font-bold text-primary">
          {Math.round((completed / items.length) * 100)}%
        </span>
      </div>

      <ul className="divide-y divide-border/80">
        {items.map((item, index) => (
          <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  item.done
                    ? "border-success bg-success-light text-success"
                    : "border-border bg-cream text-muted",
                )}
                aria-hidden="true"
              >
                {item.done ? "✓" : index + 1}
              </span>
              <div>
                <p className="font-heading text-sm font-bold text-ink">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted">{item.description}</p>
              </div>
            </div>
            {!item.done && item.href ? (
              <Link
                href={item.href}
                className="inline-flex shrink-0 items-center justify-center rounded-control border border-primary bg-teal-light px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                {item.actionLabel ?? "Start"}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
