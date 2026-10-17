"use client";

import { useRef, useState, useTransition } from "react";
import { FileUploader, type FileRuleInfo } from "@/components/upload/file-uploader";
import type { UploadedFileInfo } from "@/components/upload/upload-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { attachMasterAction, attachPreviewAction } from "../actions";

function Result({ state }: { state: ActionState | null }) {
  if (!state?.message) return null;
  return (
    <p className={cn("text-sm", state.ok ? "text-success" : "text-danger")} role="status">
      {state.message}
    </p>
  );
}

/** Editörün dışa aktardığı temiz ana dosyayı yükler ve videoya bağlar. */
export function MasterUpload({ videoId, rule }: { videoId: string; rule: FileRuleInfo }) {
  const [files, setFiles] = useState<UploadedFileInfo[]>([]);
  const filesRef = useRef<UploadedFileInfo[]>([]);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <FileUploader
        kind="TRIAL_MASTER"
        rule={rule}
        label="Temiz ana dosya (tam uzunluk, filigransız)"
        description="Satın almada müşteriye bu dosya teslim edilir; ön izleme bundan üretilir."
        files={files}
        onChange={(update) => {
          // Güncelleme fonksiyonu yan etkisiz kalır; bağlama eylemi yalnızca bir kez tetiklenir
          const prev = filesRef.current;
          const next = update(prev);
          filesRef.current = next;
          setFiles(next);
          const added = next.find((f) => !prev.some((p) => p.id === f.id));
          if (added) start(async () => setState(await attachMasterAction(videoId, added.id)));
        }}
        disabled={pending}
      />
      <Result state={state} />
    </div>
  );
}

/** ffmpeg yoksa: editörün ayrı dışa aktardığı kısa ön izleme kesiti (ve isteğe bağlı kapak). */
export function PreviewUpload({ videoId, previewRule, posterRule }: { videoId: string; previewRule: FileRuleInfo; posterRule: FileRuleInfo }) {
  const [preview, setPreview] = useState<UploadedFileInfo[]>([]);
  const [poster, setPoster] = useState<UploadedFileInfo[]>([]);
  const [watermarked, setWatermarked] = useState(true);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <FileUploader kind="TRIAL_PREVIEW" rule={previewRule} label="Ön izleme kesiti (MP4)" description="Kısa, filigranlı kesit. Müşteri yalnızca bunu görür." files={preview} onChange={(u) => setPreview(u)} />
      <FileUploader kind="TRIAL_POSTER" rule={posterRule} label="Kapak görseli (isteğe bağlı)" files={poster} onChange={(u) => setPoster(u)} />
      <Checkbox label="Bu kesitte logo filigranı var" checked={watermarked} onChange={(e) => setWatermarked(e.target.checked)} />
      <Button
        type="button"
        size="sm"
        disabled={!preview[0] || pending}
        onClick={() => start(async () => setState(await attachPreviewAction(videoId, preview[0]!.id, poster[0]?.id ?? null, watermarked)))}
      >
        {pending ? "Bağlanıyor…" : "Ön izlemeyi bağla"}
      </Button>
      <Result state={state} />
    </div>
  );
}
