// Tarayıcı tarafı yükleme akışı: başlat → (yerel uç nokta veya S3 imzalı URL'ye) PUT → doğrula.
import type { FileKindValue } from "@/lib/enums";

export type UploadedFileInfo = { id: string; kind: FileKindValue; name: string; size: number };

export class UploadError extends Error {}

async function readJson(res: Response) {
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } & Record<string, unknown> | null;
  if (!res.ok || !data?.ok) throw new UploadError(data?.error ?? `Sunucu hatası (${res.status}).`);
  return data;
}

export function uploadFile(
  file: File,
  opts: { kind: FileKindValue; orderId?: string | null; trialId?: string | null; onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<UploadedFileInfo> {
  return (async () => {
    const init = await readJson(
      await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: opts.kind, fileName: file.name, size: file.size, mimeType: file.type, orderId: opts.orderId ?? null, trialId: opts.trialId ?? null }),
        signal: opts.signal,
      }),
    );
    const fileId = init.fileId as string;
    const target = init.upload as { url: string; method: "PUT"; headers: Record<string, string> };

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(target.method, target.url);
      for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(e.loaded / e.total);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let message = `Yükleme başarısız (${xhr.status}).`;
        try {
          message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
        } catch {}
        reject(new UploadError(message));
      };
      xhr.onerror = () => reject(new UploadError("Bağlantı hatası. İnternet bağlantını kontrol edip tekrar dene."));
      xhr.onabort = () => reject(new UploadError("Yükleme iptal edildi."));
      opts.signal?.addEventListener("abort", () => xhr.abort());
      xhr.send(file);
    });

    const done = await readJson(await fetch(`/api/uploads/${fileId}/complete`, { method: "POST", signal: opts.signal }));
    return done.file as UploadedFileInfo;
  })();
}

export async function deleteUploadedFile(fileId: string) {
  await readJson(await fetch(`/api/uploads/${fileId}`, { method: "DELETE" }));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
