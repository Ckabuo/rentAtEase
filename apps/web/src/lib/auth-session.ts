const IDENTIFIER_KEY = "rae.signIn.identifier";
const CHANNEL_KEY = "rae.signIn.channel";

export type SignInChannel = "phone" | "email";

export type SignInPending = { identifier: string; channel: SignInChannel };

let signInPendingCache: { key: string; value: SignInPending | null } = { key: "", value: null };

function signInPendingCacheKey(identifier: string, channel: SignInChannel): string {
  return `${identifier}\0${channel}`;
}

export function setSignInPending(identifier: string, channel: SignInChannel): void {
  sessionStorage.setItem(IDENTIFIER_KEY, identifier);
  sessionStorage.setItem(CHANNEL_KEY, channel);
  const key = signInPendingCacheKey(identifier, channel);
  signInPendingCache = { key, value: { identifier, channel } };
}

export function readSignInPending(): SignInPending | null {
  const identifier = sessionStorage.getItem(IDENTIFIER_KEY);
  const channel = sessionStorage.getItem(CHANNEL_KEY) as SignInChannel | null;
  if (!identifier || (channel !== "phone" && channel !== "email")) {
    if (signInPendingCache.key !== "") {
      signInPendingCache = { key: "", value: null };
    }
    return null;
  }
  const key = signInPendingCacheKey(identifier, channel);
  if (signInPendingCache.key === key && signInPendingCache.value) {
    return signInPendingCache.value;
  }
  const value = { identifier, channel };
  signInPendingCache = { key, value };
  return value;
}

export function clearSignInPending(): void {
  sessionStorage.removeItem(IDENTIFIER_KEY);
  sessionStorage.removeItem(CHANNEL_KEY);
  sessionStorage.removeItem("rae.signIn.otpMeta");
  signInPendingCache = { key: "", value: null };
}

export function markSignedIn(displayName: string, token?: string): void {
  sessionStorage.setItem("rae.session.displayName", displayName);
  if (token) sessionStorage.setItem("rae.session.token", token);
}

export function clearSignedIn(): void {
  sessionStorage.removeItem("rae.session.displayName");
  sessionStorage.removeItem("rae.session.token");
  sessionStorage.removeItem("rae.signIn.devCode");
}

export function readSignedInName(): string | null {
  return sessionStorage.getItem("rae.session.displayName");
}
