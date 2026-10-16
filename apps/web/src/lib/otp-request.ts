export type OtpRequestMeta = {
  resendAvailableAt: string;
  codeExpiresAt: string;
};

const META_KEY = "rae.signIn.otpMeta";

export function writeOtpRequestMeta(meta: OtpRequestMeta): void {
  sessionStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function readOtpRequestMeta(): OtpRequestMeta | null {
  const raw = sessionStorage.getItem(META_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OtpRequestMeta;
    if (typeof parsed.resendAvailableAt !== "string" || typeof parsed.codeExpiresAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOtpRequestMeta(): void {
  sessionStorage.removeItem(META_KEY);
}

export type OtpRequestResponse = OtpRequestMeta & {
  delivery: string;
  devCode?: string;
  codeExpiresInSeconds: number;
};

export function applyOtpRequestResponse(result: OtpRequestResponse): void {
  writeOtpRequestMeta({
    resendAvailableAt: result.resendAvailableAt,
    codeExpiresAt: result.codeExpiresAt,
  });
  if (result.devCode) sessionStorage.setItem("rae.signIn.devCode", result.devCode);
  else sessionStorage.removeItem("rae.signIn.devCode");
}
