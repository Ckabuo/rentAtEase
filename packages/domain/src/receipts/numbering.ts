import type { CalendarDate } from "../vocabulary";

export interface ReceiptNumberInput {
  accountCode: string;
  issuedOn: CalendarDate;
  sequence: number;
}

function normalizeReceiptAccountCode(accountCode: string): string {
  const code = accountCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  if (!code) throw new Error("Receipt account code is empty");
  return code;
}

function receiptYear(issuedOn: CalendarDate): string {
  const year = issuedOn.slice(0, 4);
  if (!/^\d{4}$/.test(year)) throw new Error("Receipt issue date must be YYYY-MM-DD");
  return year;
}

/** `RAE<account><year><6 digits>` (e.g. `RAE4RLG2026000001`). Uniqueness is guaranteed; gaps are allowed. */
export function receiptNumberPrefix(accountCode: string, issuedOn: CalendarDate): string {
  return `RAE${normalizeReceiptAccountCode(accountCode)}${receiptYear(issuedOn)}`;
}

export function formatReceiptNumber(input: ReceiptNumberInput): string {
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new Error("Receipt sequence must be a positive integer");
  }
  const prefix = receiptNumberPrefix(input.accountCode, input.issuedOn);
  return `${prefix}${String(input.sequence).padStart(6, "0")}`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
