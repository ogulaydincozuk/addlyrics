"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FileUploader, type FileRuleInfo } from "@/components/upload/file-uploader";
import type { UploadedFileInfo } from "@/components/upload/upload-client";
import { initialActionState } from "@/lib/action-state";
import { addUploadedItemAction } from "./actions";

/** Video + kapak görseli yükleyip portfolyo öğesi oluşturur. */
export function UploadItemForm({ videoRule, posterRule, children }: { videoRule: FileRuleInfo; posterRule: FileRuleInfo; children: ReactNode }) {
  const [video, setVideo] = useState<UploadedFileInfo[]>([]);
  const [poster, setPoster] = useState<UploadedFileInfo[]>([]);
  const action = addUploadedItemAction.bind(null, video[0]?.id ?? "", poster[0]?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <FileUploader kind="PORTFOLIO_VIDEO" rule={videoRule} label="Video (MP4 veya WebM)" files={video} onChange={(u) => setVideo((p) => u(p))} />
        <FileUploader kind="PORTFOLIO_POSTER" rule={posterRule} label="Kapak görseli (isteğe bağlı)" files={poster} onChange={(u) => setPoster((p) => u(p))} />
      </div>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || video.length === 0}>
          {pending ? "Ekleniyor…" : "Örneği ekle"}
        </Button>
        {state.message && <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>}
      </div>
    </form>
  );
}
