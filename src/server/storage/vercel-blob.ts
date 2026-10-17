import "server-only";
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { BlobNotFoundError, del, get, head, issueSignedToken, presignUrl, put } from "@vercel/blob";
import type { DownloadOptions, StorageDriver, UploadTarget } from "./index";

/**
 * Vercel Blob (gizli/private depo).
 * - Yükleme: tarayıcı, sunucunun ürettiği tek dosyaya ve tek içerik türüne kilitli, süreli imzalı PUT bağlantısına
 *   doğrudan yükler; dosya sunucudan geçmez.
 * - Okuma: yetki kontrolünden sonra birkaç dakika geçerli imzalı GET bağlantısına yönlendirilir (video ileri-geri
 *   sarma için Range isteklerini CDN karşılar). Bağlantının süresi dolunca dosyaya erişilemez.
 * Kimlik doğrulama Vercel'de OIDC ile (BLOB_STORE_ID + VERCEL_OIDC_TOKEN), başka ortamlarda BLOB_READ_WRITE_TOKEN ile.
 */
export class VercelBlobStorageDriver implements StorageDriver {
  readonly name = "vercel-blob" as const;

  // Okuma imzası için depo geneli kısa ömürlü yetki; her istekte kontrol API'sine gitmemek için önbelleklenir.
  private readToken: { delegationToken: string; clientSigningToken: string; validUntil: number } | null = null;

  async createUploadTarget(input: { fileId: string; key: string; contentType: string; size: number }): Promise<UploadTarget> {
    const validUntil = Date.now() + 60 * 60 * 1000;
    const token = await issueSignedToken({
      pathname: input.key,
      operations: ["put"],
      allowedContentTypes: [input.contentType],
      maximumSizeInBytes: input.size,
      validUntil,
    });
    const { presignedUrl } = await presignUrl(token, {
      operation: "put",
      pathname: input.key,
      access: "private",
      allowedContentTypes: [input.contentType],
      maximumSizeInBytes: input.size,
      addRandomSuffix: false,
      allowOverwrite: false,
      validUntil,
    });
    return { url: presignedUrl, method: "PUT", headers: { "Content-Type": input.contentType } };
  }

  async stat(key: string) {
    try {
      const info = await head(key);
      return { size: info.size };
    } catch (err) {
      if (err instanceof BlobNotFoundError) return null;
      throw err;
    }
  }

  async readHead(key: string, bytes: number) {
    // Yeni yüklenen dosya için önbelleği atla: imza kontrolü her zaman son içeriği görmeli
    const result = await get(key, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return Buffer.alloc(0);
    const reader = result.stream.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      while (total < bytes) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
        total += value.byteLength;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    return Buffer.concat(chunks).subarray(0, bytes);
  }

  async delete(key: string) {
    await del(key);
  }

  async putFile(key: string, filePath: string, contentType: string) {
    const body = await readFile(filePath);
    await put(key, body, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
    return body.byteLength;
  }

  async getToFile(key: string, filePath: string) {
    const result = await get(key, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) throw new Error("Depolamadan dosya okunamadı");
    await pipeline(Readable.fromWeb(result.stream as unknown as NodeWebReadableStream), createWriteStream(filePath));
  }

  async downloadResponse(key: string, _opts: DownloadOptions) {
    const { presignedUrl } = await presignUrl(await this.readSigningToken(), {
      operation: "get",
      pathname: key,
      access: "private",
      validUntil: Date.now() + 5 * 60 * 1000,
    });
    return new Response(null, { status: 302, headers: { Location: presignedUrl, "Cache-Control": "private, no-store" } });
  }

  private async readSigningToken() {
    // Bitimine 10 dakikadan az kalan yetki yenilenir; böylece imzalanan bağlantı en az 5 dakika geçerli olur
    if (!this.readToken || this.readToken.validUntil - Date.now() < 10 * 60 * 1000) {
      this.readToken = await issueSignedToken({ pathname: "*", operations: ["get"], validUntil: Date.now() + 60 * 60 * 1000 });
    }
    return this.readToken;
  }
}
