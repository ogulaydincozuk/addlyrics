"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/primitives";
import { FileUploader, type FileRuleInfo } from "@/components/upload/file-uploader";
import type { UploadedFileInfo } from "@/components/upload/upload-client";
import { initialActionState } from "@/lib/action-state";
import type { CustomerFileKind, FileKindValue } from "@/lib/enums";
import { sendOrderMessage, updateLyrics } from "../../actions";

const LABELS: Record<CustomerFileKind, { label: string; description?: string; multiple?: boolean }> = {
  SONG_AUDIO: { label: "Şarkı dosyası (WAV veya MP3)" },
  LYRICS: { label: "Şarkı sözü dosyası", description: "TXT, PDF veya DOCX" },
  MUSIC_VIDEO: { label: "Müzik klibi (MP4 veya MOV)" },
  FOOTAGE: { label: "Kullanılacak görüntüler", description: "Yalnızca kullanım hakkına sahip olduğun görüntüler.", multiple: true },
  IMAGE: { label: "Ek görseller", description: "Kapak, fotoğraf veya logo.", multiple: true },
};

/** Siparişe sonradan dosya ekleme. Her yüklemeden sonra sayfa (durum) yenilenir. */
export function OrderFilesManager({
  orderId,
  kinds,
  initial,
  rules,
}: {
  orderId: string;
  kinds: CustomerFileKind[];
  initial: Partial<Record<CustomerFileKind, UploadedFileInfo[]>>;
  rules: Record<FileKindValue, FileRuleInfo>;
}) {
  const router = useRouter();
  const [files, setFiles] = useState(initial);
  return (
    <div className="space-y-6">
      {kinds.map((kind) => (
        <FileUploader
          key={kind}
          kind={kind}
          rule={rules[kind]}
          label={LABELS[kind].label}
          description={LABELS[kind].description}
          multiple={LABELS[kind].multiple}
          orderId={orderId}
          files={files[kind] ?? []}
          onChange={(update) => {
            setFiles((prev) => ({ ...prev, [kind]: update(prev[kind] ?? []) }));
            router.refresh();
          }}
        />
      ))}
    </div>
  );
}

export function LyricsForm({ orderNumber, initial }: { orderNumber: string; initial: string }) {
  const [state, action, pending] = useActionState(updateLyrics, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <Textarea name="lyrics" rows={8} defaultValue={initial} placeholder={"Birinci satır\nİkinci satır\n…"} aria-label="Şarkı sözleri" />
      {state.message && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Sözleri Kaydet"}
      </Button>
    </form>
  );
}

/** Ekibe mesaj / ekibin sorularına yanıt. */
export function OrderMessageForm({ orderNumber }: { orderNumber: string }) {
  const [state, action, pending] = useActionState(sendOrderMessage, initialActionState);
  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : "form"}>
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <label htmlFor="order-message" className="block text-sm font-semibold text-ink">
        Ekibe yaz
      </label>
      <Textarea
        id="order-message"
        name="message"
        rows={3}
        placeholder="Ekibimizin sorularını yanıtla veya eklemek istediklerini yaz."
        aria-invalid={!!state.errors?.message}
      />
      {state.errors?.message && <p className="text-sm text-danger">{state.errors.message}</p>}
      {state.message && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      <Button type="submit" size="sm" disabled={pending} icon={<Send className="size-4" aria-hidden />}>
        {pending ? "Gönderiliyor…" : "Gönder"}
      </Button>
    </form>
  );
}
