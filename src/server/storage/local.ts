import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, open, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { signToken } from "../crypto";
import { env } from "../env";
import type { DownloadOptions, StorageDriver, UploadTarget } from "./index";
import { safeDownloadName } from "./file-rules";

/**
 * Yerel disk sürücüsü — geliştirme ve tek sunuculu kurulumlar için.
 * Dosyalar `public/` dışında tutulur; erişim yalnızca yetki kontrollü API üzerinden yapılır.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;

  private root() {
    return path.resolve(env().STORAGE_LOCAL_DIR);
  }

  /** Anahtarı disk yoluna çevirir; kök dizin dışına çıkmayı engeller. */
  resolve(key: string) {
    const root = this.root();
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Geçersiz depolama anahtarı");
    return full;
  }

  async createUploadTarget(input: { fileId: string; key: string; contentType: string; size: number }): Promise<UploadTarget> {
    const token = signToken({ fid: input.fileId, key: input.key, size: input.size }, 60 * 60 * 6);
    // Belirteç URL yerine başlıkta taşınır; erişim günlüklerine düşmez
    return {
      url: `/api/uploads/${input.fileId}/content`,
      method: "PUT",
      headers: { "Content-Type": input.contentType || "application/octet-stream", "X-Upload-Token": token },
    };
  }

  /** İstek gövdesini diske yazar; beyan edilen boyutu aşarsa yazmayı keser. */
  async writeStream(key: string, body: ReadableStream<Uint8Array>, maxBytes: number) {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.part-${process.pid}-${Date.now()}`;
    let written = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        written += chunk.length;
        if (written > maxBytes) cb(new Error("SIZE_LIMIT"));
        else cb(null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), limiter, createWriteStream(tmp));
      await rename(tmp, target);
      return written;
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  }

  async stat(key: string) {
    try {
      const s = await stat(this.resolve(key));
      return s.isFile() ? { size: s.size } : null;
    } catch {
      return null;
    }
  }

  async readHead(key: string, bytes: number) {
    const handle = await open(this.resolve(key), "r");
    try {
      const buf = Buffer.alloc(bytes);
      const { bytesRead } = await handle.read(buf, 0, bytes, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }

  async putFile(key: string, filePath: string) {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(filePath, target);
    return (await stat(target)).size;
  }

  async getToFile(key: string, filePath: string) {
    await copyFile(this.resolve(key), filePath);
  }

  async downloadResponse(key: string, opts: DownloadOptions) {
    const full = this.resolve(key);
    const info = await this.stat(key);
    if (!info) return new Response("Dosya bulunamadı", { status: 404 });

    const disposition = `${opts.inline ? "inline" : "attachment"}; filename="${safeDownloadName(opts.fileName)}"; filename*=UTF-8''${encodeURIComponent(opts.fileName)}`;
    const baseHeaders: Record<string, string> = {
      "Content-Type": opts.contentType,
      "Content-Disposition": disposition,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=0, no-store",
      "X-Content-Type-Options": "nosniff",
    };

    // Video oynatıcılar için Range (kısmi içerik) desteği
    const range = parseRange(opts.rangeHeader, info.size);
    if (range === "invalid") {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    }
    if (range) {
      const stream = createReadStream(full, { start: range.start, end: range.end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${range.start}-${range.end}/${info.size}`,
          "Content-Length": String(range.end - range.start + 1),
        },
      });
    }
    const stream = createReadStream(full);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(info.size) },
    });
  }
}

export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, s, e] = m;
  let start: number;
  let end: number;
  if (s === "" && e === "") return "invalid";
  if (s === "") {
    const suffix = Number(e);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(s);
    end = e === "" ? size - 1 : Math.min(Number(e), size - 1);
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}
