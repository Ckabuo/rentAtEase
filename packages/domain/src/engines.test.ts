import { addCalendarMonths } from "./calendar";
import { generateCharges } from "./ledger/charges";
import { previewAllocation } from "./ledger/allocation";
import { rentStatus } from "./ledger/status";
import { isDuplicatePayment } from "./payments/duplicates";
import { formatReceiptNumber } from "./receipts/numbering";
import { remindersDue } from "./reminders/schedule";
import { scoreApplication } from "./scoring/score";

describe("rent charges", () => {
  it("clamps month-end dates and keeps leap-year February", () => {
    expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addCalendarMonths("2024-01-31", 2)).toBe("2024-03-31");
    expect(addCalendarMonths("2023-01-31", 1)).toBe("2023-02-28");
    expect(addCalendarMonths("2024-02-29", 12)).toBe("2025-02-28");

    const charges = generateCharges({
      startDate: "2024-01-31",
      cycle: "MONTHLY",
      rentAmountKobo: 100_000,
      throughDate: "2024-03-31",
    });
    expect(charges.map((charge) => charge.dueDate)).toEqual(["2024-01-31", "2024-02-29", "2024-03-31"]);
    expect(charges[0]?.periodEnd).toBe("2024-02-28");
    expect(charges[1]?.periodEnd).toBe("2024-03-30");
  });

  it("uses the rent rate in force at each period start", () => {
    const charges = generateCharges({
      startDate: "2026-01-01",
      cycle: "ANNUAL",
      rentAmountKobo: 100,
      throughDate: "2028-01-01",
      rates: [
        { effectiveFrom: "2026-01-01", amountKobo: 100 },
        { effectiveFrom: "2027-01-01", amountKobo: 150 },
      ],
    });
    expect(charges.map((charge) => charge.amountKobo)).toEqual([100, 150, 150]);
  });
});

describe("payment allocation", () => {
  const charges = [
    { id: "a", dueDate: "2026-01-01", amountKobo: 1_000, allocatedKobo: 0 },
    { id: "b", dueDate: "2027-01-01", amountKobo: 1_000, allocatedKobo: 0 },
  ];

  it("applies a part payment to the oldest charge", () => {
    const preview = previewAllocation({ charges, amountKobo: 400, asOf: "2026-06-01" });
    expect(preview.lines).toEqual([{ chargeId: "a", amountKobo: 400 }]);
    expect(preview.unallocatedKobo).toBe(0);
    expect(preview.summary).toMatch(/Part payment.*2026-01-01/);
  });

  it("describes prepayment after current charges are cleared", () => {
    const preview = previewAllocation({
      charges: [
        { id: "a", dueDate: "2026-01-01", amountKobo: 54_698_630, allocatedKobo: 0 },
        { id: "b", dueDate: "2027-01-01", amountKobo: 55_000_000, allocatedKobo: 0 },
      ],
      amountKobo: 55_000_000,
      asOf: "2026-06-01",
    });
    expect(preview.summary).toMatch(/Clears rent due 2026-01-01 in full/);
    expect(preview.summary).toMatch(/toward rent due 2027-01-01/);
  });

  it("covers later cycles and leaves the excess unallocated", () => {
    const preview = previewAllocation({ charges, amountKobo: 2_500, asOf: "2026-06-01" });
    expect(preview.lines).toEqual([
      { chargeId: "a", amountKobo: 1_000 },
      { chargeId: "b", amountKobo: 1_000 },
    ]);
    expect(preview.unallocatedKobo).toBe(500);
    expect(preview.summary).toMatch(/beyond the open charges/);
  });
});

describe("rent status", () => {
  it("distinguishes paid, due soon, overdue and part-paid", () => {
    expect(
      rentStatus({ today: "2026-06-01", dueDate: "2026-01-01", chargeStatus: "PAID", outstandingKobo: 0 }).status,
    ).toBe("PAID");
    expect(
      rentStatus({ today: "2026-06-01", dueDate: "2026-06-08", chargeStatus: "UNPAID", outstandingKobo: 100 }).status,
    ).toBe("DUE_SOON");
    expect(
      rentStatus({ today: "2026-06-15", dueDate: "2026-06-01", chargeStatus: "UNPAID", outstandingKobo: 100 }).status,
    ).toBe("OVERDUE");
    expect(
      rentStatus({ today: "2026-05-01", dueDate: "2026-06-01", chargeStatus: "PART_PAID", outstandingKobo: 40 }).status,
    ).toBe("PART_PAID");
  });
});

describe("reminders", () => {
  const base = {
    tenancyId: "ten-1",
    cycle: "ANNUAL" as const,
    dueDate: "2026-07-01",
    outstandingKobo: 50_000,
    whatsappConsent: true,
  };

  it("sends the 30-day reminder only inside the stale window", () => {
    expect(remindersDue({ ...base, today: "2026-06-01" }).map((item) => item.templateKey)).toEqual([
      "rae_rent_reminder",
    ]);
    expect(remindersDue({ ...base, today: "2026-06-04" })).toEqual([]);
  });

  it("skips tenants who opted out or have nothing outstanding", () => {
    expect(remindersDue({ ...base, today: "2026-06-01", whatsappConsent: false })).toEqual([]);
    expect(remindersDue({ ...base, today: "2026-06-01", outstandingKobo: 0 })).toEqual([]);
  });

  it("has no schedule yet for monthly cycles", () => {
    expect(remindersDue({ ...base, cycle: "MONTHLY", today: "2026-06-01" })).toEqual([]);
  });
});

describe("duplicate payments", () => {
  const candidate = {
    tenancyId: "ten-1",
    amountKobo: 100,
    paidOn: "2026-06-01",
    method: "CASH" as const,
    recordedAt: "2026-06-01T10:00:00.000Z",
  };

  it("warns inside 24 hours and ignores an older match", () => {
    expect(
      isDuplicatePayment(candidate, [{ ...candidate, recordedAt: "2026-06-01T20:00:00.000Z" }]),
    ).toBe(true);
    expect(
      isDuplicatePayment(candidate, [{ ...candidate, recordedAt: "2026-05-31T09:00:00.000Z" }]),
    ).toBe(false);
    expect(isDuplicatePayment(candidate, [{ ...candidate, amountKobo: 90 }])).toBe(false);
  });
});

describe("receipt numbers", () => {
  it("includes the account, year and a 6-digit sequence", () => {
    expect(formatReceiptNumber({ accountCode: "ab-12", issuedOn: "2026-10-13", sequence: 7 })).toBe(
      "RAEAB122026000007",
    );
    expect(formatReceiptNumber({ accountCode: "4RLG", issuedOn: "2026-01-01", sequence: 1 })).toBe(
      "RAE4RLG2026000001",
    );
  });
});

describe("scoring thresholds", () => {
  it("recommends decline when the declared profile is weak", () => {
    const result = scoreApplication({
      employmentStatus: "unemployed",
      yearsInCurrentJob: 0,
      monthlyIncomeKobo: 10_000,
      incomeSource: "other",
      rentAmountKobo: 1_200_000,
      rentCycle: "MONTHLY",
      guarantorAvailable: false,
      guarantorWillSign: false,
      guarantorEmployment: null,
      idDocumentProvided: false,
      proofOfIncomeProvided: false,
      idNumberFormatValid: false,
      reference: "NONE",
    });
    expect(result.recommendation).toBe("DECLINE");
    expect(result.score).toBeLessThan(50);
  });
});
