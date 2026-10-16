import { createHmac, timingSafeEqual } from "node:crypto";

type JwtPayload = Record<string, unknown> & { exp: number };

export function signJwt(payload: Record<string, unknown>, secret: string, ttlSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, iat: now(), exp: now() + ttlSeconds }));
  const signature = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export function verifyJwt<T extends Record<string, unknown>>(token: string, secret: string): T {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) throw new Error("Invalid session");
  const expected = sign(`${header}.${body}`, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("Invalid session");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as JwtPayload;
  if (typeof payload.exp !== "number" || payload.exp < now()) throw new Error("Session expired");
  return payload as T;
}

export function signInvite(accountId: string, unitId: string, ttlSeconds = 60 * 60 * 24 * 30): string {
  const body = base64url(JSON.stringify({ a: accountId, u: unitId, exp: now() + ttlSeconds }));
  return `${body}.${sign(body, secret())}`;
}

export function readInvite(token: string): { accountId: string; unitId: string } {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new Error("This application link is not valid.");
  const expected = sign(body, secret());
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error("This application link is not valid.");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { a?: string; u?: string; exp?: number };
  if (!payload.a || !payload.u || !payload.exp || payload.exp < now()) {
    throw new Error("This application link has expired. Ask the landlord for a new one.");
  }
  return { accountId: payload.a, unitId: payload.u };
}

export function signReceiptToken(receiptId: string): string {
  const body = base64url(JSON.stringify({ r: receiptId, exp: now() + 60 * 60 * 24 * 180 }));
  return `${body}.${sign(body, secret())}`;
}

export function readReceiptToken(token: string): string {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new Error("This receipt link is not valid.");
  const expected = sign(body, secret());
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("This receipt link is not valid.");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { r?: string; exp?: number };
  if (!payload.r || !payload.exp || payload.exp < now()) throw new Error("This receipt link has expired.");
  return payload.r;
}

export const ACCESS_TTL_SECONDS = 60 * 60 * 12;

function sign(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("base64url");
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function secret(): string {
  const value = process.env.JWT_ACCESS_SECRET?.trim();
  if (!value) throw new Error("JWT_ACCESS_SECRET is not set");
  return value;
}
