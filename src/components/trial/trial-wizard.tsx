"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Clapperboard, Film, Music2, ShieldCheck, Type, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/primitives";
import { FileUploader, type FileRuleInfo } from "@/components/upload/file-uploader";
import type { UploadedFileInfo } from "@/components/upload/upload-client";
import { messages } from "@/i18n/config";
import { cn } from "@/lib/cn";
import {
  RELEASE_STATUSES,
  SONG_LANGUAGES,
  VIDEO_FORMATS,
  type CustomerFileKind,
  type FileKindValue,
  type ReleaseStatusValue,
  type VideoFormatValue,
  type VideoStyleValue,
} from "@/lib/enums";
import { checkLyricsText, proposeTrialApproaches } from "@/lib/trial";
import { flattenErrors, songStepSchema } from "@/lib/validation";
import { formatBytes } from "@/components/upload/upload-client";
import { submitTrial, type TrialSubmitResult } from "@/app/(site)/ucretsiz-deneme/actions";

const t = messages();

const STEPS = ["Şarkı ve sözler", "Dosyalar", "Tercihler", "Onay"] as const;

const STYLE_CHOICES: Array<{ value: VideoStyleValue | ""; label: string; icon: typeof Film; text: string }> = [
  { value: "", label: "Karar veremedim", icon: Wand2, text: "Ekibimiz şarkına en uygun yaklaşımı seçsin." },
  { value: "FILM_EDIT", label: "Film Edit", icon: Film, text: "Sinematik görüntüler ve film atmosferi." },
  { value: "MINIMAL", label: "Minimal", icon: Type, text: "Sade zemin ve güçlü tipografi." },
  { value: "MUSIC_VIDEO", label: "Music Video", icon: Clapperboard, text: "Kendi klibinin üzerine senkron sözler." },
];

type Files = Record<CustomerFileKind, UploadedFileInfo[]>;

type SongDraft = {
  artistName: string;
  title: string;
  releaseStatus: ReleaseStatusValue | "";
  language: string;
  lyrics: string;
  streamingUrl: string;
};

type FootageChoice = "ADDLYRICS_LICENSED" | "CUSTOMER_PROVIDED";

/** Tarayıcıda saklanan taslak. Onay kutuları bilinçli olarak saklanmaz; her seferinde yeniden işaretlenir. */
type Draft = {
  song: SongDraft;
  files: Files;
  preferredStyle: VideoStyleValue | "";
  formats: VideoFormatValue[];
  footageSource: FootageChoice;
  notes: string;
};

function emptyDraft(): Draft {
  return {
    song: { artistName: "", title: "", releaseStatus: "", language: "Türkçe", lyrics: "", streamingUrl: "" },
    files: { SONG_AUDIO: [], LYRICS: [], MUSIC_VIDEO: [], IMAGE: [], FOOTAGE: [] },
    preferredStyle: "",
    formats: ["VERTICAL"],
    footageSource: "ADDLYRICS_LICENSED",
    notes: "",
  };
}

/** Kayıtlı taslağı okur; yalnızca anlamlı ilerleme varsa geri yükler (OrderWizard ile aynı yaklaşım). */
function loadDraft(draftKey: string): { draft: Draft; step: number; restored: boolean } {
  const fallback = emptyDraft();
  try {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      const parsed = JSON.parse(saved) as { draft?: Partial<Draft>; step?: number };
      const d = parsed.draft ?? {};
      const draft: Draft = {
        song: { ...fallback.song, ...d.song },
        files: { ...fallback.files, ...d.files },
        preferredStyle: d.preferredStyle ?? fallback.preferredStyle,
        formats: Array.isArray(d.formats) ? d.formats : fallback.formats,
        footageSource: d.footageSource ?? fallback.footageSource,
        notes: typeof d.notes === "string" ? d.notes : fallback.notes,
      };
      const step = Math.min(Math.max(parsed.step ?? 0, 0), STEPS.length - 1);
      const hasProgress =
        Boolean(draft.song.title.trim() || draft.song.lyrics.trim()) || Object.values(draft.files).some((list) => list.length > 0) || step > 0;
      if (hasProgress) return { draft, step, restored: true };
    }
  } catch {}
  return { draft: fallback, step: 0, restored: false };
}

/**
 * Sunucu hata anahtarları ("song.title", "fileIds", "termsAccepted"…) formdaki alan anahtarlarına ve adımlara eşlenir;
 * eşlenemeyen mesajlar genel hata kutusunda gösterilir.
 */
function mapServerErrors(fieldErrors: Record<string, string>) {
  const errors: Record<string, string> = {};
  const unmatched: string[] = [];
  let step: number | null = null;
  for (const [key, message] of Object.entries(fieldErrors)) {
    const [root, sub] = key.split(".");
    let target: { field: string; step: number } | null = null;
    if (root === "song" && sub) target = { field: sub, step: 0 };
    else if (root === "fileIds") target = { field: "audio", step: 1 };
    else if (root === "preferredStyle") target = { field: "style", step: 2 };
    else if (root === "footageSource") target = { field: "footage", step: 2 };
    else if (root === "formats") target = { field: "formats", step: 2 };
    else if (root === "notesForEditor") target = { field: "notes", step: 2 };
    else if (root === "rightsConfirmed" || root === "materialsMatchConfirmed" || root === "termsAccepted") target = { field: "confirm", step: 3 };
    if (!target) {
      unmatched.push(message);
      continue;
    }
    if (!errors[target.field]) errors[target.field] = message;
    step = step === null ? target.step : Math.min(step, target.step);
  }
  return { errors, step, unmatched };
}

const subscribeNoop = () => () => {};

type TrialWizardProps = {
  rules: Record<FileKindValue, FileRuleInfo>;
  previewHours: number;
  /** Verilirse taslak kullanıcıya özel anahtarla saklanır (aynı tarayıcıyı paylaşan hesaplar karışmaz) */
  userId?: string;
};

/**
 * Deneme başvuru sihirbazı. Taslak tarayıcıda (localStorage) tutulduğu için yalnızca istemcide render edilir;
 * sunucuda ve hidrasyon sırasında iskelet gösterilir.
 */
export function TrialWizard(props: TrialWizardProps) {
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!isClient) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Başvuru formu yükleniyor">
        <div className="h-8 w-full animate-pulse rounded-xl bg-slate-200/70" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
    );
  }
  return <TrialWizardInner {...props} />;
}

function TrialWizardInner({ rules, previewHours, userId }: TrialWizardProps) {
  const draftKey = userId ? `addlyrics-trial:${userId}` : "addlyrics-trial";
  // Kaydedilmiş taslak (yalnızca istemcide çalışır; bileşen sunucuda render edilmez)
  const [initial] = useState(() => loadDraft(draftKey));
  const [step, setStep] = useState(initial.step);
  const [song, setSong] = useState<SongDraft>(initial.draft.song);
  const [files, setFiles] = useState<Files>(initial.draft.files);
  const [preferredStyle, setPreferredStyle] = useState<VideoStyleValue | "">(initial.draft.preferredStyle);
  const [formats, setFormats] = useState<VideoFormatValue[]>(initial.draft.formats);
  const [footageSource, setFootageSource] = useState<FootageChoice>(initial.draft.footageSource);
  const [notes, setNotes] = useState(initial.draft.notes);
  const [confirm, setConfirm] = useState({ rights: false, match: false, terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [restored, setRestored] = useState(initial.restored);
  const [submitting, startSubmit] = useTransition();

  // Taslağı tarayıcıda sakla (sayfa yenilenirse veya sekme kapanırsa kaybolmasın)
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ draft: { song, files, preferredStyle, formats, footageSource, notes }, step }));
    } catch {}
  }, [draftKey, song, files, preferredStyle, formats, footageSource, notes, step]);

  function resetDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    const fresh = emptyDraft();
    setSong(fresh.song);
    setFiles(fresh.files);
    setPreferredStyle(fresh.preferredStyle);
    setFormats(fresh.formats);
    setFootageSource(fresh.footageSource);
    setNotes(fresh.notes);
    setConfirm({ rights: false, match: false, terms: false });
    setStep(0);
    setErrors({});
    setServerError(null);
    setRestored(false);
  }

  const hasMusicVideo = files.MUSIC_VIDEO.length > 0;
  const approaches = useMemo(
    () => proposeTrialApproaches({ hasMusicVideo, preferred: preferredStyle || null }),
    [hasMusicVideo, preferredStyle],
  );
  const lyricProblems = checkLyricsText(song.lyrics);

  const setKind = (kind: CustomerFileKind) => (update: (prev: UploadedFileInfo[]) => UploadedFileInfo[]) =>
    setFiles((f) => ({ ...f, [kind]: update(f[kind]) }));

  function validateStep(s: number) {
    if (s === 0) {
      const parsed = songStepSchema.safeParse({ ...song, streamingUrl: song.streamingUrl || undefined });
      const errs = parsed.success ? {} : flattenErrors(parsed.error);
      if (lyricProblems.length) errs.lyrics = lyricProblems[0]!;
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }
    if (s === 1) {
      const errs: Record<string, string> = {};
      if (!files.SONG_AUDIO.length) errs.audio = "Şarkının ses dosyasını yükle (MP3 veya WAV).";
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }
    if (s === 2) {
      const errs: Record<string, string> = {};
      if (!formats.length) errs.formats = "En az bir format seç.";
      if (preferredStyle === "MUSIC_VIDEO" && !hasMusicVideo) errs.style = "Klip üzerine lyrics için önce müzik klibini yükle.";
      if (footageSource === "CUSTOMER_PROVIDED" && !files.FOOTAGE.length && !hasMusicVideo) errs.footage = "Kendi görüntülerini yükle veya lisanslı stok görüntü seçeneğini seç.";
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }
    return true;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit() {
    if (!confirm.rights || !confirm.match || !confirm.terms) {
      setErrors({ confirm: "Devam etmek için üç onayı da vermelisin." });
      return;
    }
    setServerError(null);
    const fileIds = Object.values(files).flat().map((f) => f.id);
    const snapshot = JSON.stringify({ draft: { song, files, preferredStyle, formats, footageSource, notes }, step });
    startSubmit(async () => {
      // Başarılı olursa sunucu yönlendirir; taslak önceden silinir, hata olursa geri yazılır
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      const result: TrialSubmitResult | undefined = await submitTrial({
        song: { ...song, streamingUrl: song.streamingUrl || undefined },
        preferredStyle: preferredStyle || undefined,
        footageSource,
        formats,
        notesForEditor: notes || undefined,
        fileIds,
        rightsConfirmed: confirm.rights,
        materialsMatchConfirmed: confirm.match,
        termsAccepted: confirm.terms,
      });
      if (result && !result.ok) {
        try {
          localStorage.setItem(draftKey, snapshot);
        } catch {}
        if (result.fieldErrors) {
          // "song.title" gibi anahtarlar ilgili alana eşlenir ve ilk hatanın olduğu adıma dönülür
          const mapped = mapServerErrors(result.fieldErrors);
          setErrors(mapped.errors);
          setServerError([result.error, ...mapped.unmatched].join("\n"));
          if (mapped.step !== null && mapped.step !== step) {
            setStep(mapped.step);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        } else {
          setServerError(result.error);
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      <ol className="grid grid-cols-4 gap-2" aria-label="Başvuru adımları">
        {STEPS.map((label, i) => (
          <li key={label} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", i <= step ? "bg-brand" : "bg-line")} />
            <p className={cn("mt-2 truncate text-xs font-semibold sm:text-sm", i === step ? "text-ink" : "text-muted")} aria-current={i === step ? "step" : undefined}>
              {i + 1}. {label}
            </p>
          </li>
        ))}
      </ol>

      {restored && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-soft bg-brand-tint px-4 py-2.5 text-sm text-brand-ink">
          <span>Kaldığın yerden devam ediyorsun.</span>
          <button type="button" onClick={resetDraft} className="font-semibold underline-offset-2 hover:underline">
            Baştan başla
          </button>
        </div>
      )}

      {serverError && (
        <Alert tone="danger" title="Başvurun gönderilemedi">
          <p className="whitespace-pre-line">{serverError}</p>
        </Alert>
      )}

      {step === 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sanatçı adı" htmlFor="artistName" error={errors.artistName}>
            <Input id="artistName" value={song.artistName} onChange={(e) => setSong({ ...song, artistName: e.target.value })} maxLength={120} />
          </Field>
          <Field label="Şarkı adı" htmlFor="title" error={errors.title}>
            <Input id="title" value={song.title} onChange={(e) => setSong({ ...song, title: e.target.value })} maxLength={160} />
          </Field>
          <Field label="Yayın durumu" htmlFor="releaseStatus" error={errors.releaseStatus}>
            <Select id="releaseStatus" value={song.releaseStatus} onChange={(e) => setSong({ ...song, releaseStatus: e.target.value as ReleaseStatusValue })}>
              <option value="">Seç…</option>
              {RELEASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.enums.releaseStatus[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Şarkı dili" htmlFor="language" error={errors.language}>
            <Select id="language" value={song.language} onChange={(e) => setSong({ ...song, language: e.target.value })}>
              {SONG_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Şarkı sözleri"
            htmlFor="lyrics"
            error={errors.lyrics}
            hint="Sözleri satır satır, şarkıda söylendiği sırayla yaz. Videolar bu metne göre hazırlanır."
            className="sm:col-span-2"
          >
            <Textarea id="lyrics" rows={10} value={song.lyrics} onChange={(e) => setSong({ ...song, lyrics: e.target.value })} maxLength={20000} />
          </Field>
          <Field label="Şarkının yayın bağlantısı" htmlFor="streamingUrl" optional error={errors.streamingUrl} className="sm:col-span-2">
            <Input id="streamingUrl" type="url" placeholder="https://" value={song.streamingUrl} onChange={(e) => setSong({ ...song, streamingUrl: e.target.value })} />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <Alert tone="info" title="Desteklenen dosyalar">
            Ses: MP3/WAV (en fazla {formatBytes(rules.SONG_AUDIO.maxBytes)}) · Video: MP4/MOV (en fazla {formatBytes(rules.MUSIC_VIDEO.maxBytes)}) · Görsel: JPG/PNG/WEBP
            (en fazla {formatBytes(rules.IMAGE.maxBytes)}) · Söz dosyası: TXT/PDF/DOCX. Dosyalar yalnızca senin ve ekibimizin erişebildiği alanda saklanır.
          </Alert>
          <div>
            <FileUploader kind="SONG_AUDIO" rule={rules.SONG_AUDIO} label="Şarkının ses dosyası (zorunlu)" description="Videoda kullanılacak tam şarkı. Sözlerle aynı şarkı olmalı." files={files.SONG_AUDIO} onChange={setKind("SONG_AUDIO")} />
            {errors.audio && <p className="mt-1.5 text-sm text-danger">{errors.audio}</p>}
          </div>
          <FileUploader kind="MUSIC_VIDEO" rule={rules.MUSIC_VIDEO} label="Müzik klibin (isteğe bağlı)" description="Yüklersen üçüncü video klibinin üzerine sözler olarak hazırlanır." files={files.MUSIC_VIDEO} onChange={setKind("MUSIC_VIDEO")} />
          <FileUploader kind="IMAGE" rule={rules.IMAGE} label="Görseller (isteğe bağlı)" description="Kapak, fotoğraf veya logo." multiple maxFiles={10} files={files.IMAGE} onChange={setKind("IMAGE")} />
          <FileUploader kind="FOOTAGE" rule={rules.FOOTAGE} label="Kendi görüntülerin (isteğe bağlı)" description="Kullanım hakkına sahip olduğun video görüntüleri." multiple maxFiles={5} files={files.FOOTAGE} onChange={setKind("FOOTAGE")} />
          <FileUploader kind="LYRICS" rule={rules.LYRICS} label="Söz dosyası (isteğe bağlı)" description="Yazdığın sözlere ek olarak varsa orijinal söz dosyası." files={files.LYRICS} onChange={setKind("LYRICS")} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Öncelikli tarzın</legend>
            <p className="mt-1 text-sm text-muted">Üç video birbirinden farklı yaklaşımlarla hazırlanır; seçtiğin tarz ilk sırada olur.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {STYLE_CHOICES.map((c) => {
                const disabled = c.value === "MUSIC_VIDEO" && !hasMusicVideo;
                const on = preferredStyle === c.value;
                return (
                  <label
                    key={c.label}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                      on ? "border-brand bg-brand-tint ring-2 ring-brand-soft" : "border-line bg-card hover:border-line-strong",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input type="radio" name="style" className="sr-only" checked={on} disabled={disabled} onChange={() => setPreferredStyle(c.value)} />
                    <c.icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                    <span>
                      <span className="block font-semibold text-ink">{c.label}</span>
                      <span className="block text-sm text-muted">{disabled ? "Önce müzik klibini yükle." : c.text}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.style && <p className="mt-1.5 text-sm text-danger">{errors.style}</p>}
          </fieldset>

          <div className="rounded-xl border border-line bg-canvas p-4">
            <p className="text-sm font-semibold text-ink">Hazırlanacak üç video</p>
            <ol className="mt-2 space-y-1.5 text-sm text-ink-soft">
              {approaches.map((a) => (
                <li key={a.sequence} className="flex gap-2">
                  <span className="font-semibold text-brand">{a.sequence}.</span> {a.approach}
                </li>
              ))}
            </ol>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-ink">Video formatı</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {VIDEO_FORMATS.map((f) => {
                const on = formats.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFormats((prev) => (on ? prev.filter((x) => x !== f) : [...prev, f]))}
                    className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold", on ? "border-brand bg-brand-tint text-brand-ink" : "border-line bg-card text-ink-soft")}
                  >
                    {on && <Check className="size-4" aria-hidden />}
                    {t.enums.videoFormat[f]}
                  </button>
                );
              })}
            </div>
            {errors.formats && <p className="mt-1.5 text-sm text-danger">{errors.formats}</p>}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-ink">Film Edit görüntüleri</legend>
            <div className="mt-2 space-y-2">
              {(["ADDLYRICS_LICENSED", "CUSTOMER_PROVIDED"] as const).map((v) => (
                <label key={v} className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
                  <input type="radio" name="footage" className="mt-1 accent-brand" checked={footageSource === v} onChange={() => setFootageSource(v)} />
                  {t.enums.footageSource[v]}
                </label>
              ))}
            </div>
            {errors.footage && <p className="mt-1.5 text-sm text-danger">{errors.footage}</p>}
          </fieldset>

          <Field label="Editöre notun" htmlFor="notes" optional error={errors.notes} hint="Renk, yazı tipi, öne çıkmasını istediğin satırlar…">
            <Textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="grid gap-3 rounded-xl border border-line bg-canvas p-4 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted">Şarkı:</span> <span className="font-semibold text-ink">{song.artistName} – {song.title}</span>
            </p>
            <p>
              <span className="text-muted">Dosyalar:</span>{" "}
              <span className="font-semibold text-ink">{Object.values(files).flat().length} dosya</span>
            </p>
            <p>
              <span className="text-muted">Format:</span> <span className="font-semibold text-ink">{formats.map((f) => t.enums.videoFormatShort[f]).join(", ")}</span>
            </p>
            <p>
              <span className="text-muted">Videolar:</span> <span className="font-semibold text-ink">3 farklı yaklaşım</span>
            </p>
          </div>

          <Alert tone="info" title="Bundan sonra ne olacak?">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Ekibimiz dosyalarının üretime uygun olduğunu ve sözlerin şarkıyla eşleştiğini kontrol eder. Eksik varsa sana yazarız.</li>
              <li>Dosyaların onaylandıktan sonra üç ön izlemen için hedefimiz {previewHours} saattir. Gecikme olursa haber veririz.</li>
              <li>Ön izlemeler kısa ve filigranlıdır. Paket satın alırsan aynı üç videonun tam ve temiz sürümleri yeniden üretilmeden teslim edilir.</li>
            </ul>
          </Alert>

          <div className="space-y-3">
            <Checkbox
              label="Şarkının ve gönderdiğim materyallerin kullanım haklarına sahibim veya gerekli izinleri aldım."
              checked={confirm.rights}
              onChange={(e) => setConfirm({ ...confirm, rights: e.target.checked })}
            />
            <Checkbox
              label="Yüklediğim ses dosyası ile yazdığım sözler aynı şarkıya ait."
              checked={confirm.match}
              onChange={(e) => setConfirm({ ...confirm, match: e.target.checked })}
            />
            <Checkbox
              label={
                <>
                  <Link href="/ucretsiz-deneme-kosullari" target="_blank" className="font-semibold text-brand hover:underline">
                    Ücretsiz deneme koşullarını
                  </Link>{" "}
                  ve{" "}
                  <Link href="/kvkk-aydinlatma-metni" target="_blank" className="font-semibold text-brand hover:underline">
                    KVKK aydınlatma metnini
                  </Link>{" "}
                  okudum, kabul ediyorum.
                </>
              }
              checked={confirm.terms}
              onChange={(e) => setConfirm({ ...confirm, terms: e.target.checked })}
            />
            {errors.confirm && <p className="text-sm text-danger">{errors.confirm}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" disabled={step === 0 || submitting} onClick={() => setStep((s) => Math.max(0, s - 1))} icon={<ArrowLeft className="size-4" aria-hidden />}>
          Geri
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next} icon={null}>
            Devam <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={submitting} icon={<ShieldCheck className="size-4" aria-hidden />}>
            {submitting ? "Gönderiliyor…" : "Başvuruyu Gönder"}
          </Button>
        )}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted">
        <Music2 className="size-3.5" aria-hidden /> Bilgilerin yalnızca deneme videolarının hazırlanması için kullanılır.
      </p>
    </div>
  );
}
