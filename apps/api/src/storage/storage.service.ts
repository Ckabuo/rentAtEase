import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { s3Configured } from "../config/env";

@Injectable()
export class StorageService {
  private readonly root = path.resolve(__dirname, "../../.data");

  mode(): "s3" | "local" {
    this.assertStorageChoice();
    return s3Configured() ? "s3" : "local";
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    if (this.mode() === "local") {
      const file = this.localPath(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
      return;
    }
    await this.client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<Uint8Array> {
    if (this.mode() === "local") {
      return readFile(this.localPath(key));
    }
    const result = await this.client().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
    const body = await result.Body?.transformToByteArray();
    if (!body) throw new ServiceUnavailableException("The stored file was empty.");
    return body;
  }

  async presignPut(key: string, contentType: string): Promise<{ uploadUrl: string; headers: Record<string, string> }> {
    if (this.mode() !== "s3") {
      throw new ServiceUnavailableException("S3 is not configured. Use the local upload URL from presign.");
    }
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client(), command, { expiresIn: 60 * 5 });
    return { uploadUrl, headers: { "Content-Type": contentType } };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.get(key);
      return true;
    } catch {
      return false;
    }
  }

  private assertStorageChoice(): void {
    const bucket = process.env.S3_BUCKET?.trim();
    if (!bucket) return;
    if (!s3Configured()) {
      throw new ServiceUnavailableException(
        "S3_BUCKET is set but S3_REGION, S3_ACCESS_KEY_ID, or S3_SECRET_ACCESS_KEY is missing.",
      );
    }
  }

  private localPath(key: string): string {
    const safe = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return path.join(this.root, safe);
  }

  private client(): S3Client {
    return new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT?.trim()),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
}
