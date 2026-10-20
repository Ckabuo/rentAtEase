export const NIGERIAN_PHONE_LENGTH = 11;

/** Local Nigerian mobile numbers: 11 digits starting with 0 (e.g. 08030000000). */
export const NIGERIAN_PHONE_PATTERN = /^0[789]\d{9}$/;

export function normalizeNigerianPhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, NIGERIAN_PHONE_LENGTH);
}

/** Local `080…` form. Maps `234…` (13 digits) back to `0…`. */
export function toLocalNigerianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) return `0${digits.slice(3)}`;
  return digits;
}

export function isValidNigerianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === NIGERIAN_PHONE_LENGTH && NIGERIAN_PHONE_PATTERN.test(digits);
}
