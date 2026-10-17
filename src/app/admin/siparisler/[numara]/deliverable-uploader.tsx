"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/field";
import { FileUploader, type FileRuleInfo } from "@/components/upload/file-uploader";
import type { UploadedFileInfo } from "@/components/upload/upload-client";
import { addDeliverableAction } from "../actions";

/**
 * Editörün hazırladığı videoyu yükler ve ilgili video işine (proje) bağlar.
 * Video müşteriye otomatik açılmaz; "Müşteriye teslim et" ile yayınlanır.
 */
export function DeliverableUploader({ projectId, rule }: { projectId: string; rule: FileRuleInfo }) {
  const router = useRouter();
  const noteRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<UploadedFileInfo[]>([]);
  const [files, setFiles] = useState<UploadedFileInfo[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function handleChange(update: (prev: UploadedFileInfo[]) => UploadedFileInfo[]) {
    // Yan etkiler (sunucu eylemi) state güncelleyicisinin dışında çalışır
    const prev = filesRef.current;
    const next = update(prev);
    filesRef.current = next;
    setFiles(next);
    const added = next.filter((f) => !prev.some((p) => p.id === f.id));
    for (const f of added) {
      void addDeliverableAction(projectId, f.id, noteRef.current?.value ?? "").then((res) => {
        setMessage({ ok: res.ok, text: res.message ?? "" });
        if (res.ok) {
          filesRef.current = [];
          setFiles([]);
          if (noteRef.current) noteRef.current.value = "";
          router.refresh();
        }
      });
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-line-strong bg-canvas p-3">
      <Input ref={noteRef} placeholder="Editör notu (isteğe bağlı, müşteri görür)" className="h-9 text-sm" aria-label="Editör notu" />
      <FileUploader kind="DELIVERABLE" rule={rule} label="Yeni sürüm yükle" files={files} onChange={handleChange} />
      {message && <p className={message.ok ? "text-sm text-success" : "text-sm text-danger"}>{message.text}</p>}
    </div>
  );
}
