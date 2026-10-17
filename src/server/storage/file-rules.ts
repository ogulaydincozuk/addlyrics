import "server-only";
import type { FileKindValue } from "@/lib/enums";
import { env } from "../env";

export type FileRule = {
  extensions: string[];
  mimeTypes: string[];
  maxBytes: number;
  /** İçerik imzası kontrolü (ilk baytlar) */
  signatures: Array<(head: Buffer) => boolean>;
};

const MB = 1024 * 1024;

// ─────────── Dosya imzaları (magic bytes) ───────────
const isMp3 = (b: Buffer) =>
  b.subarray(0, 3).toString("latin1") === "ID3" || (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0);
const isWav = (b: Buffer) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WAVE";
const isIsoBmff = (b: Buffer) => b.subarray(4, 8).toString("latin1") === "ftyp"; // MP4 / MOV
const isWebm = (b: Buffer) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const isJpeg = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isWebp = (b: Buffer) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
const isPdf = (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-";
const isZip = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04; // DOCX
const isText = (b: Buffer) => {
  // UTF-8 / UTF-16 BOM ya da kontrol karakteri içermeyen metin
  if (b.length === 0) return false;
  if ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff)) return true;
  for (const byte of b) {
    if (byte === 0) return false;
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) return false;
  }
  return true;
};

export function fileRules(): Record<FileKindValue, FileRule> {
  const e = env();
  const audio: FileRule = {
    extensions: [".mp3", ".wav"],
    mimeTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
    maxBytes: e.UPLOAD_MAX_AUDIO_MB * MB,
    signatures: [isMp3, isWav],
  };
  const video: FileRule = {
    extensions: [".mp4", ".mov"],
    mimeTypes: ["video/mp4", "video/quicktime"],
    maxBytes: e.UPLOAD_MAX_VIDEO_MB * MB,
    signatures: [isIsoBmff],
  };
  const image: FileRule = {
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: e.UPLOAD_MAX_IMAGE_MB * MB,
    signatures: [isJpeg, isPng, isWebp],
  };
  return {
    SONG_AUDIO: audio,
    LYRICS: {
      extensions: [".txt", ".pdf", ".docx"],
      mimeTypes: [
        "text/plain",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      maxBytes: e.UPLOAD_MAX_DOC_MB * MB,
      signatures: [isPdf, isZip, isText],
    },
    MUSIC_VIDEO: video,
    FOOTAGE: video,
    IMAGE: image,
    DELIVERABLE: video,
    PORTFOLIO_VIDEO: { ...video, extensions: [".mp4", ".webm"], mimeTypes: ["video/mp4", "video/webm"], signatures: [isIsoBmff, isWebm] },
    PORTFOLIO_POSTER: image,
    TRIAL_MASTER: video,
    TRIAL_PREVIEW: { ...video, extensions: [".mp4"], mimeTypes: ["video/mp4"] },
    TRIAL_POSTER: image,
  };
}

/** İstemciye gönderilebilecek özet (input accept ve boyut uyarıları için). */
export function publicFileRules() {
  const rules = fileRules();
  return Object.fromEntries(
    Object.entries(rules).map(([kind, r]) => [kind, { accept: [...r.extensions, ...r.mimeTypes].join(","), maxBytes: r.maxBytes, extensions: r.extensions }]),
  ) as Record<FileKindValue, { accept: string; maxBytes: number; extensions: string[] }>;
}

export function extensionOf(fileName: string) {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

export type FileCheck = { ok: true } | { ok: false; error: string };

export function validateDeclaredFile(kind: FileKindValue, fileName: string, mimeType: string, size: number): FileCheck {
  const rule = fileRules()[kind];
  const ext = extensionOf(fileName);
  if (!rule.extensions.includes(ext)) {
    return { ok: false, error: `Bu alan için desteklenen dosya türleri: ${rule.extensions.join(", ")}` };
  }
  // Bazı tarayıcılar MIME türünü boş gönderir; bu durumda uzantı ve içerik imzası esas alınır.
  if (mimeType && !rule.mimeTypes.includes(mimeType.toLowerCase())) {
    return { ok: false, error: "Dosya türü bu alan için uygun değil." };
  }
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "Dosya boş görünüyor." };
  if (size > rule.maxBytes) {
    return { ok: false, error: `Dosya çok büyük. En fazla ${Math.round(rule.maxBytes / MB)} MB yükleyebilirsin.` };
  }
  return { ok: true };
}

export function matchesSignature(kind: FileKindValue, head: Buffer) {
  return fileRules()[kind].signatures.some((check) => check(head));
}

const TR_ASCII: Record<string, string> = { ı: "i", İ: "I", ş: "s", Ş: "S", ğ: "g", Ğ: "G", ç: "c", Ç: "C", ö: "o", Ö: "O", ü: "u", Ü: "U" };

/**
 * Content-Disposition için güvenli dosya adı. HTTP başlıkları yalnızca ASCII taşıyabildiği için Türkçe harfler
 * karşılıklarına çevrilir, kalan ASCII dışı karakterler "_" olur (özgün ad filename* ile UTF-8 olarak ayrıca gönderilir).
 */
export function safeDownloadName(name: string) {
  const ascii = name
    .replace(/[ıİşŞğĞçÇöÖüÜ]/g, (c) => TR_ASCII[c] ?? "_")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\/;]/g, "_")
    .slice(0, 150)
    .trim();
  return ascii || "dosya";
}

/** Content-Disposition başlığı: ASCII yedek ad + RFC 5987 ile UTF-8 özgün ad (tarayıcılar Türkçe adı korur). */
export function contentDisposition(fileName: string, inline: boolean) {
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? "inline" : "attachment"}; filename="${safeDownloadName(fileName)}"; filename*=UTF-8''${encoded}`;
}

export function contentTypeFor(kind: FileKindValue, fileName: string, declared: string) {
  const ext = extensionOf(fileName);
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] ?? (fileRules()[kind].mimeTypes.includes(declared) ? declared : "application/octet-stream");
}
