import { clearSignedIn } from "@/lib/auth-session";
import { toast } from "@/lib/toast";

const TOKEN_KEY = "rae.session.token";

const AUTH_NO_REDIRECT_ON_401 = ["/auth/otp/request", "/auth/otp/verify", "/auth/sign-out"];

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly duplicate = false,
    readonly retryAfterSeconds?: number,
    readonly resendAvailableAt?: string,
  ) {
    super(message);
  }
}

function readApiErrorFields(record: Record<string, unknown>): {
  message: string;
  duplicate: boolean;
  retryAfterSeconds?: number;
  resendAvailableAt?: string;
} {
  const nested =
    record.message && typeof record.message === "object" && !Array.isArray(record.message)
      ? (record.message as Record<string, unknown>)
      : null;
  const source = nested ?? record;

  const rawMessage = source.message ?? record.message;
  const message = Array.isArray(rawMessage)
    ? "Check the form and try again."
    : typeof rawMessage === "string"
      ? rawMessage
      : "Request failed.";

  const retryAfterSeconds =
    typeof source.retryAfterSeconds === "number"
      ? source.retryAfterSeconds
      : typeof record.retryAfterSeconds === "number"
        ? record.retryAfterSeconds
        : undefined;

  const resendAvailableAt =
    typeof source.resendAvailableAt === "string"
      ? source.resendAvailableAt
      : typeof record.resendAvailableAt === "string"
        ? record.resendAvailableAt
        : undefined;

  return {
    message,
    duplicate: Boolean(source.duplicate ?? record.duplicate),
    retryAfterSeconds,
    resendAvailableAt,
  };
}

export const API_UNREACHABLE_MESSAGE = "We could not reach the server. Try again in a moment.";

export function otpResendAvailableAt(caught: unknown): string | null {
  if (caught instanceof ApiError && caught.resendAvailableAt) {
    return caught.resendAvailableAt;
  }
  return null;
}

export function apiErrorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) {
    if (caught.status === 0) return API_UNREACHABLE_MESSAGE;
    if (caught.resendAvailableAt) return fallback;
    return caught.message;
  }
  return fallback;
}

export function toastApiError(caught: unknown, fallback: string): void {
  toast.error(apiErrorMessage(caught, fallback));
}

export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function readToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function writeToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

function shouldRedirectToSignInOn401(path: string): boolean {
  if (path.startsWith("/public/")) return false;
  return !AUTH_NO_REDIRECT_ON_401.some((prefix) => path === prefix || path.startsWith(`${prefix}?`));
}

/** Clears client session state and navigates to sign-in (e.g. expired or revoked session). */
export function redirectToSignIn(): void {
  clearToken();
  clearSignedIn();
  toast.error("Your session expired. Sign in again.");
  window.location.assign(`${window.location.origin}/sign-in`);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = typeof window === "undefined" ? null : readToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${apiBase()}/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(API_UNREACHABLE_MESSAGE, 0);
  }
  if (response.status === 401 && shouldRedirectToSignInOn401(path)) {
    redirectToSignIn();
    throw new ApiError("Sign in to continue.", 401);
  }
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const fields = readApiErrorFields(record);
    const fallback =
      response.status === 500
        ? "Something went wrong on the server. Try preview again, or use the exact outstanding amount from Tenants."
        : `Request failed (${response.status}).`;
    const message = fields.message === "Request failed." ? fallback : fields.message;
    throw new ApiError(
      message,
      response.status,
      fields.duplicate,
      fields.retryAfterSeconds,
      fields.resendAvailableAt,
    );
  }
  return payload as T;
}
