import "server-only";
import { env } from "../env";
import { LocalStorageDriver } from "./local";
import { S3StorageDriver } from "./s3";

export type UploadTarget = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

export type DownloadOptions = {
  fileName: string;
  contentType: string;
  inline: boolean;
  rangeHeader: string | null;
};

export interface StorageDriver {
  readonly name: "local" | "s3";
  createUploadTarget(input: { fileId: string; key: string; contentType: string; size: number }): Promise<UploadTarget>;
  stat(key: string): Promise<{ size: number } | null>;
  readHead(key: string, bytes: number): Promise<Buffer>;
  delete(key: string): Promise<void>;
  downloadResponse(key: string, opts: DownloadOptions): Promise<Response>;
  /** Sunucuda üretilen dosyayı (ör. ön izleme kesiti) depolamaya yazar; boyutu döndürür. */
  putFile(key: string, filePath: string, contentType: string): Promise<number>;
  /** Depolamadaki dosyayı sunucuda işlemek için geçici bir dosyaya indirir. */
  getToFile(key: string, filePath: string): Promise<void>;
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  driver = env().STORAGE_DRIVER === "s3" ? new S3StorageDriver() : new LocalStorageDriver();
  return driver;
}

/** Depolama anahtarı: kullanıcı kimliği + tarih + dosya kimliği. Orijinal dosya adı anahtarda kullanılmaz. */
export function buildStorageKey(scope: "uploads" | "deliverables" | "portfolio" | "trials", ownerId: string, fileId: string, ext: string) {
  const now = new Date();
  const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const safeExt = /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : "";
  return `${scope}/${ownerId}/${month}/${fileId}${safeExt}`;
}
