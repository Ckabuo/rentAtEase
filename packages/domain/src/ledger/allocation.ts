import { formatNaira } from "../money";
import type { CalendarDate } from "../vocabulary";

export interface OpenCharge {
  id: string;
  dueDate: CalendarDate;
  amountKobo: number;
  allocatedKobo: number;
}

export interface AllocationLine {
  chargeId: string;
  amountKobo: number;
}

/** The preview a landlord confirms before a payment is stored. */
export interface AllocationPreview {
  lines: AllocationLine[];
  unallocatedKobo: number;
  summary: string;
}

/**
 * Applies a payment oldest-first across open charges.
 * Supports part, advance and multi-year payments.
 */
export function previewAllocation(input: {
  charges: OpenCharge[];
  amountKobo: number;
  asOf: CalendarDate;
}): AllocationPreview {
  if (!Number.isInteger(input.amountKobo) || input.amountKobo < 0) {
    throw new Error("Amounts must be whole kobo");
  }
  const ordered = [...input.charges].sort((left, right) => {
    const byDate = left.dueDate.localeCompare(right.dueDate);
    return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
  });
  let remaining = input.amountKobo;
  const lines: AllocationLine[] = [];
  for (const charge of ordered) {
    const open = charge.amountKobo - charge.allocatedKobo;
    if (open <= 0 || remaining <= 0) continue;
    const applied = Math.min(open, remaining);
    lines.push({ chargeId: charge.id, amountKobo: applied });
    remaining -= applied;
  }
  return {
    lines,
    unallocatedKobo: remaining,
    summary: describeAllocation(ordered, lines, remaining, input.asOf),
  };
}

function describeAllocation(
  charges: OpenCharge[],
  lines: AllocationLine[],
  unallocatedKobo: number,
  asOf: CalendarDate,
): string {
  if (lines.length === 0) {
    return unallocatedKobo > 0
      ? `${formatNaira(unallocatedKobo)} is not applied. There is no open charge on ${asOf}.`
      : "Nothing to apply.";
  }
  const byId = new Map(charges.map((charge) => [charge.id, charge]));
  const appliedById = new Map<string, number>();
  for (const line of lines) {
    appliedById.set(line.chargeId, (appliedById.get(line.chargeId) ?? 0) + line.amountKobo);
  }
  const stillOn = (charge: OpenCharge) => {
    const open = charge.amountKobo - charge.allocatedKobo;
    const applied = appliedById.get(charge.id) ?? 0;
    return open - applied;
  };
  const touched = [...new Set(lines.map((line) => line.chargeId))]
    .map((id) => byId.get(id))
    .filter((charge): charge is OpenCharge => charge != null)
    .sort((left, right) => {
      const byDate = left.dueDate.localeCompare(right.dueDate);
      return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
    });
  const firstDue = touched[0]?.dueDate ?? "";
  const lastDue = touched[touched.length - 1]?.dueDate ?? "";
  const outstandingAfter = touched.reduce((sum, charge) => sum + stillOn(charge), 0);
  const fullCount = touched.filter((charge) => stillOn(charge) === 0).length;

  const parts: string[] = [];
  if (fullCount === touched.length && outstandingAfter === 0) {
    parts.push(
      touched.length === 1
        ? `Covers the charge due ${firstDue} in full.`
        : `Covers ${touched.length} charges in full, from ${firstDue} to ${lastDue}.`,
    );
  } else if (touched.length === 1 && outstandingAfter > 0) {
    parts.push(`Part payment. ${formatNaira(outstandingAfter)} remains on rent due ${firstDue}.`);
  } else if (
    touched.length >= 2 &&
    touched.slice(0, -1).every((charge) => stillOn(charge) === 0) &&
    stillOn(touched[touched.length - 1]) > 0
  ) {
    const advance = touched[touched.length - 1];
    const advanceApplied = appliedById.get(advance.id) ?? 0;
    const advanceStill = stillOn(advance);
    parts.push(
      touched.length === 2
        ? `Clears rent due ${touched[0].dueDate} in full.`
        : `Clears rent through ${touched[touched.length - 2].dueDate}.`,
      `${formatNaira(advanceApplied)} toward rent due ${advance.dueDate}; ${formatNaira(advanceStill)} remains on that period.`,
    );
  } else if (outstandingAfter > 0) {
    parts.push(`Part payment. ${formatNaira(outstandingAfter)} remains across open charges.`);
  } else {
    parts.push(`Covers ${fullCount} charge${fullCount === 1 ? "" : "s"} in full.`);
  }
  if (unallocatedKobo > 0) {
    parts.push(
      `${formatNaira(unallocatedKobo)} is beyond the open charges. Advance cover stops 36 months ahead.`,
    );
  }
  return parts.join(" ");
}
