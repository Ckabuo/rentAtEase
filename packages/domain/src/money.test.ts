import { formatNaira, koboToNaira, nairaToKobo, parseWholeNairaInput } from "./money";
import { canAddCaretaker, canAddUnit, canRunPrequalification } from "./plans";
import { scoreApplication } from "./scoring/score";

describe("money", () => {
  it("stores naira as whole kobo", () => {
    expect(nairaToKobo(5500)).toBe(550_000);
    expect(koboToNaira(550_000)).toBe(5500);
  });

  it("formats naira with the naira sign and thousands separators", () => {
    expect(formatNaira(450_000_000)).toBe("₦4,500,000");
    expect(formatNaira(150)).toBe("₦1.50");
  });

  it("rejects fractional kobo", () => {
    expect(() => formatNaira(10.5)).toThrow(/whole kobo/);
  });

  it("parses whole naira input for forms", () => {
    expect(parseWholeNairaInput("5500")).toBe(550_000);
    expect(parseWholeNairaInput(" 1,500,000 ")).toBe(150_000_000);
    expect(parseWholeNairaInput("546986.30")).toBe(54_698_630);
    expect(parseWholeNairaInput("500.5")).toBe(50_050);
  });

  it("rejects invalid naira input", () => {
    expect(() => parseWholeNairaInput("")).toThrow(/Enter an amount/);
    expect(() => parseWholeNairaInput("0")).toThrow(/greater than zero/);
    expect(() => parseWholeNairaInput("500.505")).toThrow(/valid amount/);
    expect(() => parseWholeNairaInput("abc")).toThrow(/valid amount/);
  });
});

describe("plan limits", () => {
  it("enforces the starter unit, caretaker and pre-qualification caps", () => {
    expect(canAddUnit("STARTER", 2)).toBe(true);
    expect(canAddUnit("STARTER", 3)).toBe(false);
    expect(canAddUnit("PRO", 100)).toBe(true);
    expect(canAddCaretaker("STARTER", 0)).toBe(false);
    expect(canAddCaretaker("STANDARD", 1)).toBe(true);
    expect(canRunPrequalification("STARTER", 0)).toBe(true);
    expect(canRunPrequalification("STARTER", 1)).toBe(false);
  });
});

describe("scoring engine", () => {
  it("scores a strong declared application as approve", () => {
    const result = scoreApplication({
      employmentStatus: "employed",
      yearsInCurrentJob: 3,
      monthlyIncomeKobo: 40_000_000,
      incomeSource: "salary",
      rentAmountKobo: 150_000_000,
      rentCycle: "ANNUAL",
      guarantorAvailable: true,
      guarantorWillSign: true,
      guarantorEmployment: "employed",
      idDocumentProvided: true,
      proofOfIncomeProvided: true,
      idNumberFormatValid: true,
      reference: "PROVIDED",
    });
    expect(result.score).toBe(97);
    expect(result.recommendation).toBe("APPROVE");
    expect(result.breakdown).toEqual({
      employment: 30,
      income: 25,
      guarantor: 20,
      documents: 15,
      reference: 7,
    });
    expect(result.rubricVersion).toBe("0.1");
  });
});
