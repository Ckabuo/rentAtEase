const KOBO_PER_NAIRA = 100;

export function nairaToKobo(naira: number): number {
  if (!Number.isInteger(naira)) {
    throw new Error("Naira amounts must be whole naira before conversion to kobo");
  }
  return naira * KOBO_PER_NAIRA;
}

/** Parses user-entered naira (commas/spaces allowed). Optional ".dd" is kobo (max 2 digits). Returns whole kobo. */
export function parseWholeNairaInput(input: string): number {
  const normalized = input.trim().replace(/[\s,]/g, "");
  if (!normalized) {
    throw new Error("Enter an amount in naira.");
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    throw new Error("Enter a valid amount (e.g. 550000 or 546986.30).");
  }
  const naira = Number(match[1]);
  const koboPart = match[2] ? match[2].padEnd(2, "0") : "00";
  const kobo = naira * KOBO_PER_NAIRA + Number(koboPart);
  if (!Number.isSafeInteger(kobo) || kobo <= 0) {
    throw new Error("Enter a valid amount greater than zero.");
  }
  return kobo;
}

export function koboToNaira(kobo: number): number {
  assertWholeKobo(kobo);
  return kobo / KOBO_PER_NAIRA;
}

/** Formats whole kobo as Naira. A kobo remainder is shown so no amount is rounded away. */
export function formatNaira(kobo: number): string {
  assertWholeKobo(kobo);
  const negative = kobo < 0;
  const absolute = Math.abs(kobo);
  const naira = Math.trunc(absolute / KOBO_PER_NAIRA);
  const remainder = absolute % KOBO_PER_NAIRA;
  const formatted = naira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = negative ? "-" : "";
  if (remainder === 0) {
    return `${sign}₦${formatted}`;
  }
  return `${sign}₦${formatted}.${remainder.toString().padStart(2, "0")}`;
}

function assertWholeKobo(kobo: number): void {
  if (!Number.isInteger(kobo)) {
    throw new Error("Amounts must be whole kobo");
  }
}
