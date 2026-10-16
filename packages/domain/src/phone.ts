export const NIGERIAN_PHONE_LENGTH = 11;

/** Local Nigerian mobile numbers: 11 digits starting with 0 (e.g. 08030000000). */
export const NIGERIAN_PHONE_PATTERN = /^0[789]\d{9}$/;

export function normalizeNigerianPhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, NIGERIAN_PHONE_LENGTH);
}

export function isValidNigerianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === NIGERIAN_PHONE_LENGTH && NIGERIAN_PHONE_PATTERN.test(digits);
}
