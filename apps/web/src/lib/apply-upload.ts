import { api } from "@/lib/api";
import type { UploadedApplyDocument } from "@/lib/apply-form";

type PresignResponse =
  | { mode: "s3"; key: string; uploadUrl: string; headers: Record<string, string> }
  | { mode: "local"; key: string; uploadUrl: string; token: string };

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function allowedContentType(file: File): "image/jpeg" | "image/png" | "application/pdf" | null {
  if (file.type === "image/jpeg" || file.type === "image/png" || file.type === "application/pdf") {
    return file.type;
  }
  return null;
}

export async function uploadApplyDocument(
  applyToken: string,
  kind: UploadedApplyDocument["kind"],
  file: File,
): Promise<UploadedApplyDocument> {
  const contentType = allowedContentType(file);
  if (!contentType) throw new Error("Use JPG, PNG, or PDF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Files must be 10 MB or smaller.");

  const presign = await api<PresignResponse>(`/public/apply/${applyToken}/presign`, {
    method: "POST",
    body: JSON.stringify({ kind, contentType, sizeBytes: file.size }),
  });

  const bytes = await file.arrayBuffer();

  if (presign.mode === "s3") {
    const response = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { ...presign.headers, "Content-Type": contentType },
      body: bytes,
    });
    if (!response.ok) throw new Error("Upload failed. Try again.");
    return {
      kind,
      storageKey: presign.key,
      contentType,
      sizeBytes: file.size,
      sha256: await sha256Hex(bytes),
      fileName: file.name,
    };
  }

  const base64 = arrayBufferToBase64(bytes);
  const stored = await api<{ key: string; sizeBytes: number; sha256: string; contentType: string }>("/uploads/local", {
    method: "POST",
    body: JSON.stringify({ token: presign.token, contentBase64: base64 }),
  });

  return {
    kind,
    storageKey: stored.key,
    contentType: stored.contentType,
    sizeBytes: stored.sizeBytes,
    sha256: stored.sha256,
    fileName: file.name,
  };
}
