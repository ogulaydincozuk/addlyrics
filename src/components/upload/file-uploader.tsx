"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileAudio, FileText, FileVideo, ImageIcon, Loader2, RotateCcw, Trash2, UploadCloud, X } from "lucide-react";
import type { FileKindValue } from "@/lib/enums";
import { cn } from "@/lib/cn";
import { deleteUploadedFile, formatBytes, uploadFile, type UploadedFileInfo } from "./upload-client";

export type FileRuleInfo = { accept: string; maxBytes: number; extensions: string[] };

type Pending = { localId: string; file: File; progress: number; error?: string; controller: AbortController };

const KIND_ICON: Partial<Record<FileKindValue, typeof FileAudio>> = {
  SONG_AUDIO: FileAudio,
  LYRICS: FileText,
  MUSIC_VIDEO: FileVideo,
  FOOTAGE: FileVideo,
  DELIVERABLE: FileVideo,
  PORTFOLIO_VIDEO: FileVideo,
  IMAGE: ImageIcon,
  PORTFOLIO_POSTER: ImageIcon,
  TRIAL_MASTER: FileVideo,
  TRIAL_PREVIEW: FileVideo,
  TRIAL_POSTER: ImageIcon,
};

/**
 * Dosya yükleme alanı: sürükle-bırak, ilerleme çubuğu, iptal, tekrar deneme ve silme.
 * Dosya türü/boyutu istemcide ön kontrol edilir; asıl doğrulama sunucudadır.
 */
export function FileUploader({
  kind,
  rule,
  label,
  description,
  multiple = false,
  maxFiles = 10,
  orderId,
  trialId,
  files,
  onChange,
  disabled,
}: {
  kind: FileKindValue;
  rule: FileRuleInfo;
  label: string;
  description?: string;
  multiple?: boolean;
  maxFiles?: number;
  orderId?: string | null;
  /** Eksik bilgi istenen deneme başvurusuna dosya ekleme */
  trialId?: string | null;
  files: UploadedFileInfo[];
  /** Fonksiyonel güncelleme: eşzamanlı biten yüklemeler birbirini ezmez */
  onChange: (update: (prev: UploadedFileInfo[]) => UploadedFileInfo[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = KIND_ICON[kind] ?? FileText;
  const limitReached = !multiple ? files.length + pending.length >= 1 : files.length + pending.length >= maxFiles;

  function precheck(file: File) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!rule.extensions.includes(ext)) return `Desteklenen türler: ${rule.extensions.join(", ")}`;
    if (file.size > rule.maxBytes) return `Dosya çok büyük (en fazla ${formatBytes(rule.maxBytes)}).`;
    if (file.size === 0) return "Dosya boş görünüyor.";
    return null;
  }

  function start(file: File, existingId?: string) {
    const localId = existingId ?? `${Date.now()}-${Math.random()}`;
    const controller = new AbortController();
    setPending((p) => [...p.filter((x) => x.localId !== localId), { localId, file, progress: 0, controller }]);
    uploadFile(file, {
      kind,
      orderId,
      trialId,
      signal: controller.signal,
      onProgress: (fraction) => setPending((p) => p.map((x) => (x.localId === localId ? { ...x, progress: fraction } : x))),
    })
      .then((info) => {
        setPending((p) => p.filter((x) => x.localId !== localId));
        onChange((prev) => [...prev, info]);
      })
      .catch((err: Error) => {
        setPending((p) => p.map((x) => (x.localId === localId ? { ...x, error: err.message } : x)));
      });
  }

  function handleFiles(list: FileList | null) {
    setError(null);
    if (!list?.length) return;
    const room = multiple ? maxFiles - files.length - pending.length : 1 - files.length - pending.length;
    const selected = Array.from(list).slice(0, Math.max(0, room));
    if (list.length > selected.length) setError(`En fazla ${multiple ? maxFiles : 1} dosya ekleyebilirsin.`);
    for (const file of selected) {
      const problem = precheck(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        continue;
      }
      start(file);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(id: string) {
    setError(null);
    try {
      await deleteUploadedFile(id);
      onChange((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
      {description && <p className="-mt-0.5 mb-2.5 text-sm text-muted">{description}</p>}

      {!limitReached && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors disabled:opacity-50",
            dragging ? "border-brand bg-brand-tint" : "border-line-strong bg-canvas hover:border-brand hover:bg-brand-tint/60",
          )}
        >
          <UploadCloud className="size-7 text-brand" aria-hidden />
          <span className="text-sm font-semibold text-ink">Dosya seç veya buraya sürükle</span>
          <span className="text-xs text-muted">
            {rule.extensions.join(", ").replace(/\./g, "").toUpperCase()} · en fazla {formatBytes(rule.maxBytes)}
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={rule.accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {(files.length > 0 || pending.length > 0) && (
        <ul className="mt-3 space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-3">
              <Icon className="size-5 shrink-0 text-brand" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{f.name}</p>
                <p className="text-xs text-muted">{formatBytes(f.size)}</p>
              </div>
              <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Yüklendi" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                  aria-label={`${f.name} dosyasını kaldır`}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.localId} className="rounded-xl border border-line bg-card px-3.5 py-3">
              <div className="flex items-center gap-3">
                {p.error ? <X className="size-5 shrink-0 text-danger" aria-hidden /> : <Loader2 className="size-5 shrink-0 animate-spin text-brand" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{p.file.name}</p>
                  <p className={cn("text-xs", p.error ? "text-danger" : "text-muted")}>
                    {p.error ?? `${Math.round(p.progress * 100)}% · ${formatBytes(p.file.size)}`}
                  </p>
                </div>
                {p.error ? (
                  <>
                    <button
                      type="button"
                      onClick={() => start(p.file, p.localId)}
                      className="rounded-lg p-1.5 text-muted hover:bg-brand-tint hover:text-brand"
                      aria-label="Tekrar dene"
                    >
                      <RotateCcw className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPending((list) => list.filter((x) => x.localId !== p.localId))}
                      className="rounded-lg p-1.5 text-muted hover:bg-canvas"
                      aria-label="Kaldır"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => p.controller.abort()}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-canvas hover:text-ink"
                  >
                    İptal
                  </button>
                )}
              </div>
              {!p.error && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-valuenow={Math.round(p.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${Math.max(3, p.progress * 100)}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
