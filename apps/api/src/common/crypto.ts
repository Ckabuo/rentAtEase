import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";

export function randomDigits(length = 6): string {
  if (length <= 0) return "";
  let digits = "";
  for (let i = 0; i < length; i++) {
    digits += String(randomInt(0, 10));
  }
  return digits;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function hashOtp(code: string): string {
  return createHmac("sha256", requiredSecret("JWT_ACCESS_SECRET")).update(code).digest("hex");
}

export function hashesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function maskDestination(value: string): string {
  if (value.includes("@")) {
    const [name, domain] = value.split("@");
    return `${(name ?? "").slice(0, 2)}•••@${domain ?? ""}`;
  }
  const digits = value.replace(/\D/g, "");
  return `•••${digits.slice(-4)}`;
}

export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) digits = `234${digits.slice(1)}`;
  return digits;
}

export function encryptField(plain: string): { ciphertext: string; blindIndex: string } {
  const key = fieldKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`,
    blindIndex: createHmac("sha256", key).update(normalizeId(plain)).digest("hex"),
  };
}

export function decryptField(ciphertext: string): string {
  const [ivPart, tagPart, dataPart] = ciphertext.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Stored ID number is unreadable");
  const decipher = createDecipheriv("aes-256-gcm", fieldKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}

export function idNumberLooksValid(idType: string | undefined, idNumber: string | undefined): boolean {
  if (!idNumber?.trim()) return false;
  const compact = idNumber.replace(/\s/g, "");
  const type = (idType ?? "").toLowerCase();
  if (type.includes("nin") || type.includes("bvn") || type.includes("national")) return /^\d{11}$/.test(compact);
  if (type.includes("passport")) return /^[A-Za-z0-9]{6,12}$/.test(compact);
  return compact.length >= 6 && compact.length <= 20;
}

function normalizeId(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

function fieldKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new ServiceUnavailableException(
      "FIELD_ENCRYPTION_KEY is not set. Add a base64-encoded 32-byte key before storing ID numbers.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new ServiceUnavailableException("FIELD_ENCRYPTION_KEY must be 32 bytes encoded as base64.");
  }
  return key;
}

function requiredSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
