"use client";

import { useActionState, useState, useTransition } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/primitives";
import { FileUploader, type FileRuleInfo } from "@/components/upload/file-uploader";
import type { UploadedFileInfo } from "@/components/upload/upload-client";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import type { FileKindValue } from "@/lib/enums";
import { resubmitTrialAction, startTrialPurchase } from "./actions";

/** Eksik bilgi istendiğinde: sözleri düzelt, dosya ekle, ekibe not yaz ve yeniden gönder. */
export function TrialResubmitForm({
  trialId,
  lyrics,
  notes,
  rules,
  files,
}: {
  trialId: string;
  lyrics: string;
  notes: string;
  rules: Record<FileKindValue, FileRuleInfo>;
  files: UploadedFileInfo[];
}) {
  const [state, action, pending] = useActionState(resubmitTrialAction, initialActionState);
  const [uploaded, setUploaded] = useState<Record<string, UploadedFileInfo[]>>({
    SONG_AUDIO: files.filter((f) => f.kind === "SONG_AUDIO"),
    MUSIC_VIDEO: files.filter((f) => f.kind === "MUSIC_VIDEO"),
    IMAGE: files.filter((f) => f.kind === "IMAGE"),
    FOOTAGE: files.filter((f) => f.kind === "FOOTAGE"),
  });
  const setter = (kind: string) => (update: (prev: UploadedFileInfo[]) => UploadedFileInfo[]) => setUploaded((u) => ({ ...u, [kind]: update(u[kind] ?? []) }));

  return (
    <form action={action} className="space-y-5">
      <Field label="Şarkı sözleri" htmlFor="lyrics" error={state.errors?.lyrics}>
        <Textarea id="lyrics" name="lyrics" rows={8} defaultValue={lyrics} maxLength={20000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <FileUploader kind="SONG_AUDIO" rule={rules.SONG_AUDIO} label="Ses dosyası" trialId={trialId} files={uploaded.SONG_AUDIO ?? []} onChange={setter("SONG_AUDIO")} />
        <FileUploader kind="MUSIC_VIDEO" rule={rules.MUSIC_VIDEO} label="Müzik klibi" trialId={trialId} files={uploaded.MUSIC_VIDEO ?? []} onChange={setter("MUSIC_VIDEO")} />
        <FileUploader kind="IMAGE" rule={rules.IMAGE} label="Görseller" multiple maxFiles={10} trialId={trialId} files={uploaded.IMAGE ?? []} onChange={setter("IMAGE")} />
        <FileUploader kind="FOOTAGE" rule={rules.FOOTAGE} label="Görüntüler" multiple maxFiles={5} trialId={trialId} files={uploaded.FOOTAGE ?? []} onChange={setter("FOOTAGE")} />
      </div>
      <Field label="Editöre notun" htmlFor="notesForEditor" optional>
        <Textarea id="notesForEditor" name="notesForEditor" rows={3} defaultValue={notes} maxLength={4000} />
      </Field>
      <Field label="Ekibe mesajın" htmlFor="message" optional>
        <Textarea id="message" name="message" rows={2} maxLength={2000} placeholder="Neyi düzelttiğini kısaca yaz." />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Gönderiliyor…" : "Yeniden kontrole gönder"}
        </Button>
        {state.message && (
          <p className={cn("whitespace-pre-line text-sm", state.ok ? "text-success" : "text-danger")} role="status">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function TrialPurchaseButton({ packageSlug, label, featured }: { packageSlug: string; label: string; featured?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        type="button"
        block
        variant={featured ? "primary" : "secondary"}
        disabled={pending}
        icon={<ShoppingBag className="size-4" aria-hidden />}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await startTrialPurchase(packageSlug);
            if (result && !result.ok) setError(result.error);
          })
        }
      >
        {pending ? "Hazırlanıyor…" : label}
      </Button>
      {error && (
        <Alert tone="danger" className="mt-3">
          {error}
        </Alert>
      )}
    </div>
  );
}
