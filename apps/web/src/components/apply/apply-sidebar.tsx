"use client";

import { formatNaira } from "@rae/domain";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  applyFullName,
  formatApplyUnitType,
  stepComplete,
  type ApplyFormState,
  type ApplyUnit,
} from "@/lib/apply-form";

type ApplySidebarProps = {
  unit: ApplyUnit;
  form: ApplyFormState;
  maxStepReached: number;
};

export function ApplySidebar({ unit, form, maxStepReached }: ApplySidebarProps) {
  const checklist = [
    { label: "Unit confirmed", done: maxStepReached >= 1 },
    { label: "Personal info", done: stepComplete(2, form) },
    { label: "Employment", done: stepComplete(3, form) },
    { label: "Guarantor", done: stepComplete(4, form) },
    { label: "Documents", done: stepComplete(5, form) },
    { label: "Ready to submit", done: stepComplete(6, form) },
  ];

  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-6">
      <Card>
        <CardTitle className="text-base">Selected unit</CardTitle>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Property" value={unit.property} />
          <Row label="Unit" value={unit.unit} />
          <Row label="Type" value={formatApplyUnitType(unit.unitType ?? "OTHER")} />
          <Row label="Annual rent" value={formatNaira(unit.rentAmountKobo)} />
          <Row label="City" value={unit.city} />
          <Row label="Applicant" value={applyFullName(form) || "—"} />
        </dl>
      </Card>

      <Card>
        <CardTitle className="text-base">Completion checklist</CardTitle>
        <ul className="mt-4 space-y-2">
          {checklist.map((item) => (
            <li
              key={item.label}
              className={cn("flex items-center gap-2 text-sm", item.done ? "font-medium text-primary" : "text-muted")}
            >
              <span
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded border text-[0.65rem]",
                  item.done ? "border-primary bg-primary text-on-primary" : "border-border",
                )}
                aria-hidden
              >
                {item.done ? "✓" : ""}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
        Your answers are declared, not verified. The landlord reviews your application and decides.
        </p>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}
