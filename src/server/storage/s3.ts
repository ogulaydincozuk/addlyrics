import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { stat as statFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, s3Configured } from "../env";
import type { DownloadOptions, StorageDriver, UploadTarget } from "./index";
import { safeDownloadName } from "./file-rules";

/**
 * S3 uyumlu depolama (AWS S3, Cloudflare R2, MinIO).
 * Büyük dosyalar sunucudan geçmeden, imzalı URL ile doğrudan depolamaya yüklenir.
 * Kova (bucket) herkese kapalı olmalı ve APP_URL için PUT isteklerine CORS izni verilmelidir.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;
  private client: S3Client | null = null;

  private s3() {
    if (!s3Configured()) {
      throw new Error("STORAGE_DRIVER=s3 seçili fakat S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY tanımlı değil.");
    }
    if (!this.client) {
      const e = env();
      this.client = new S3Client({
        region: e.S3_REGION,
        endpoint: e.S3_ENDPOINT,
        forcePathStyle: e.S3_FORCE_PATH_STYLE,
        credentials: { accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY! },
      });
    }
    return this.client;
  }

  private bucket() {
    return env().S3_BUCKET!;
  }

  async createUploadTarget(input: { fileId: string; key: string; contentType: string; size: number }): Promise<UploadTarget> {
    const command = new PutObjectCommand({
      Bucket: this.bucket(),
      Key: input.key,
      ContentType: input.contentType,
      // Boyut imzaya dahil edilir: istemci farklı boyutta dosya gönderemez
      ContentLength: input.size,
    });
    const url = await getSignedUrl(this.s3(), command, { expiresIn: 60 * 60 * 6 });
    return { url, method: "PUT", headers: { "Content-Type": input.contentType } };
  }

  async stat(key: string) {
    try {
      const res = await this.s3().send(new HeadObjectCommand({ Bucket: this.bucket(), Key: key }));
      return { size: Number(res.ContentLength ?? 0) };
    } catch {
      return null;
    }
  }

  async readHead(key: string, bytes: number) {
    const res = await this.s3().send(new GetObjectCommand({ Bucket: this.bucket(), Key: key, Range: `bytes=0-${bytes - 1}` }));
    const arr = await res.Body?.transformToByteArray();
    return Buffer.from(arr ?? []);
  }

  async delete(key: string) {
    await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }));
  }

  async putFile(key: string, filePath: string, contentType: string) {
    const size = (await statFile(filePath)).size;
    await this.s3().send(
      new PutObjectCommand({ Bucket: this.bucket(), Key: key, Body: createReadStream(filePath), ContentLength: size, ContentType: contentType }),
    );
    return size;
  }

  async getToFile(key: string, filePath: string) {
    const res = await this.s3().send(new GetObjectCommand({ Bucket: this.bucket(), Key: key }));
    if (!res.Body) throw new Error("Depolamadan boş yanıt");
    await pipeline(res.Body as Readable, createWriteStream(filePath));
  }

  async downloadResponse(key: string, opts: DownloadOptions) {
    const disposition = `${opts.inline ? "inline" : "attachment"}; filename="${safeDownloadName(opts.fileName)}"; filename*=UTF-8''${encodeURIComponent(opts.fileName)}`;
    const url = await getSignedUrl(
      this.s3(),
      new GetObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        ResponseContentDisposition: disposition,
        ResponseContentType: opts.contentType,
      }),
      { expiresIn: 300 },
    );
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  }
}
