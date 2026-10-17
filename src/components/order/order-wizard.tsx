"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  FileCheck2,
  Info,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  Type,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/primitives";
import { FileUploader, type FileRuleInfo } from "@/components/upload/file-uploader";
import type { UploadedFileInfo } from "@/components/upload/upload-client";
import { messages } from "@/i18n/config";
import { cn } from "@/lib/cn";
import {
  FOOTAGE_SOURCES,
  PLATFORMS,
  RELEASE_STATUSES,
  SONG_LANGUAGES,
  VIDEO_FORMATS,
  VIDEO_STYLES,
  type CustomerFileKind,
  type FileKindValue,
  type FootageSourceValue,
  type PlatformValue,
  type ReleaseStatusValue,
  type VideoFormatValue,
  type VideoStyleValue,
} from "@/lib/enums";
import { formatMoney } from "@/lib/money";
import { NO_REVISION_TEXT, PREPARATION_TEXT } from "@/lib/packages";
import { missingRequiredItems, REQUIRED_ITEM_LABELS } from "@/lib/order-requirements";
import { flattenErrors, formatStepSchema, orderInputSchema, songStepSchema, styleStepSchema } from "@/lib/validation";
import type { OrderSubmitResult, ReferralPreviewResult } from "@/app/(site)/siparis/actions";

const t = messages();

export type WizardPackage = {
  name: string;
  durationMonths: number;
  priceKurus: number | null;
  currency: string;
  /** Teslim edilecek toplam video (bonus dahil) */
  totalVideos: number;
  bonusVideos: number;
  maxVideosForOrder: number;
  deliveryTerms: string;
  deliveryDays: number | null;
  includedFormats: VideoFormatValue[];
  includedStyles: VideoStyleValue[];
  isSample: boolean;
  /** Paket hakkı modunda kalan süre bilgisi */
  endsAtLabel?: string;
};

type Draft = {
  song: {
    artistName: string;
    title: string;
    releaseStatus: ReleaseStatusValue | "";
    language: string;
    languageOther: string;
    lyrics: string;
    streamingUrl: string;
  };
  style: {
    style: VideoStyleValue | "";
    customStyleRequest: string;
    footageSource: FootageSourceValue | "";
    fontPreference: string;
    colorPreference: string;
    referenceUrl: string;
    notesForEditor: string;
  };
  format: { formats: VideoFormatValue[]; platforms: PlatformValue[]; otherPlatform: string; videoCount: number };
  uploads: Partial<Record<CustomerFileKind, UploadedFileInfo[]>>;
  rightsConfirmed: boolean;
  termsAccepted: boolean;
  /** Satın almada isteğe bağlı referans/indirim kodu (sunucuda doğrulanır) */
  referralCode: string;
};

type CodePreview = Extract<ReferralPreviewResult, { ok: true }>;

const STEPS = [
  { key: "song", label: "Şarkı" },
  { key: "style", label: "Video tarzı" },
  { key: "format", label: "Format" },
  { key: "files", label: "Dosyalar" },
  { key: "summary", label: "Özet" },
] as const;

const STYLE_META: Record<VideoStyleValue, { icon: typeof Video; description: string }> = {
  FILM_EDIT: { icon: Clapperboard, description: "Sinematik görüntüler ve film atmosferiyle sözler." },
  MINIMAL: { icon: Type, description: "Sade arka plan, güçlü tipografi, sözlere odak." },
  MUSIC_VIDEO: { icon: Video, description: "Kendi müzik klibinin üzerine senkron sözler." },
  CUSTOM: { icon: Sparkles, description: "Aklındaki özel tasarımı anlat, ekibimiz değerlendirsin." },
};

function emptyDraft(artistName: string, pkg: WizardPackage): Draft {
  return {
    song: { artistName, title: "", releaseStatus: "", language: "Türkçe", languageOther: "", lyrics: "", streamingUrl: "" },
    style: {
      style: "",
      customStyleRequest: "",
      footageSource: "",
      fontPreference: "",
      colorPreference: "",
      referenceUrl: "",
      notesForEditor: "",
    },
    format: {
      formats: pkg.includedFormats.includes("VERTICAL") ? ["VERTICAL"] : pkg.includedFormats.slice(0, 1),
      platforms: [],
      otherPlatform: "",
      videoCount: 1,
    },
    uploads: {},
    rightsConfirmed: false,
    termsAccepted: false,
    referralCode: "",
  };
}

/** Tarayıcıda kayıtlı taslağı okur; yalnızca anlamlı ilerleme varsa geri yükler. */
function loadDraft(draftKey: string, fallback: Draft): { draft: Draft; step: number; restored: boolean } {
  try {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      const parsed = JSON.parse(saved) as { draft: Draft; step: number };
      const hasProgress = Boolean(parsed.draft?.song?.title?.trim()) || (parsed.step ?? 0) > 0;
      if (hasProgress) {
        return {
          draft: { ...fallback, ...parsed.draft, rightsConfirmed: false, termsAccepted: false },
          step: Math.min(parsed.step ?? 0, STEPS.length - 1),
          restored: true,
        };
      }
    }
  } catch {}
  return { draft: fallback, step: 0, restored: false };
}

const subscribeNoop = () => () => {};

type WizardProps = {
  mode: "purchase" | "entitlement";
  pkg: WizardPackage;
  rules: Record<FileKindValue, FileRuleInfo>;
  defaultArtistName: string;
  draftKey: string;
  submit: (raw: unknown) => Promise<OrderSubmitResult>;
  /** Satın almada referans kodunu sipariş öncesinde doğrulayıp indirimi gösterir */
  checkReferralCode?: (code: string) => Promise<ReferralPreviewResult>;
};

/**
 * Sipariş sihirbazı. Taslak tarayıcıda (localStorage) tutulduğu için yalnızca istemcide render edilir;
 * sunucuda ve hidrasyon sırasında iskelet gösterilir.
 */
export function OrderWizard(props: WizardProps) {
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!isClient) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Sipariş formu yükleniyor">
        <div className="h-8 w-full animate-pulse rounded-xl bg-slate-200/70" />
        <div className="h-96 animate-pulse rounded-[1.4rem] bg-slate-200/70" />
      </div>
    );
  }
  return <OrderWizardInner {...props} />;
}

function OrderWizardInner({ mode, pkg, rules, defaultArtistName, draftKey, submit, checkReferralCode }: WizardProps) {
  // Kaydedilmiş taslak (yalnızca istemcide çalışır; bileşen sunucuda render edilmez)
  const [initial] = useState(() => loadDraft(draftKey, emptyDraft(defaultArtistName, pkg)));
  const [draft, setDraft] = useState<Draft>(initial.draft);
  const [step, setStep] = useState(initial.step);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [restored, setRestored] = useState(initial.restored);
  const [pending, startTransition] = useTransition();
  const [codePreview, setCodePreview] = useState<CodePreview | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codePending, startCodeTransition] = useTransition();
  const codeEnabled = mode === "purchase" && !!checkReferralCode;

  // Taslağı tarayıcıda sakla (sayfa yenilenirse kaybolmasın)
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ draft, step }));
    } catch {}
  }, [draft, step, draftKey]);

  const update = <K extends keyof Draft>(key: K, value: Partial<Draft[K]>) =>
    setDraft((d) => ({ ...d, [key]: typeof d[key] === "object" && !Array.isArray(d[key]) ? { ...(d[key] as object), ...value } : value }));

  const setUploads = (kind: CustomerFileKind) => (fn: (prev: UploadedFileInfo[]) => UploadedFileInfo[]) =>
    setDraft((d) => ({ ...d, uploads: { ...d.uploads, [kind]: fn(d.uploads[kind] ?? []) } }));

  const input = useMemo(() => {
    const s = draft.song;
    const st = draft.style;
    return {
      song: {
        artistName: s.artistName,
        title: s.title,
        releaseStatus: s.releaseStatus || undefined,
        language: s.language === "Diğer" ? s.languageOther : s.language,
        lyrics: s.lyrics,
        streamingUrl: s.streamingUrl,
      },
      style: {
        style: st.style || undefined,
        customStyleRequest: st.customStyleRequest,
        footageSource: st.style === "FILM_EDIT" ? st.footageSource || undefined : undefined,
        fontPreference: st.fontPreference,
        colorPreference: st.colorPreference,
        referenceUrl: st.referenceUrl,
        notesForEditor: st.notesForEditor,
      },
      format: draft.format,
      fileIds: Object.values(draft.uploads).flatMap((list) => (list ?? []).map((f) => f.id)),
      rightsConfirmed: draft.rightsConfirmed,
      termsAccepted: draft.termsAccepted,
    };
  }, [draft]);

  const missing = missingRequiredItems({
    style: (draft.style.style || "MINIMAL") as VideoStyleValue,
    footageSource: draft.style.footageSource || null,
    lyricsText: draft.song.lyrics,
    fileKinds: Object.entries(draft.uploads)
      .filter(([, list]) => (list ?? []).length > 0)
      .map(([k]) => k),
  });

  function validateStep(index: number): boolean {
    let result: ReturnType<typeof songStepSchema.safeParse> | ReturnType<typeof styleStepSchema.safeParse> | ReturnType<typeof formatStepSchema.safeParse> | null = null;
    let prefix = "";
    const extra: Record<string, string> = {};
    if (index === 0) {
      result = songStepSchema.safeParse(input.song);
      prefix = "song.";
    } else if (index === 1) {
      result = styleStepSchema.safeParse(input.style);
      prefix = "style.";
      if (draft.style.style && !pkg.includedStyles.includes(draft.style.style)) extra["style.style"] = t.common.notIncluded;
    } else if (index === 2) {
      result = formatStepSchema.safeParse(input.format);
      prefix = "format.";
      if (draft.format.videoCount > pkg.maxVideosForOrder) extra["format.videoCount"] = `En fazla ${pkg.maxVideosForOrder} video seçebilirsin.`;
    } else if (index === 3) {
      if (!draft.rightsConfirmed) extra.rightsConfirmed = "Devam etmek için kullanım haklarına ilişkin onayı vermelisin.";
    }
    const errs: Record<string, string> = { ...extra };
    if (result && !result.success) {
      for (const [k, v] of Object.entries(flattenErrors(result.error))) errs[prefix + k] = v;
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => document.querySelector("[aria-invalid=true], [data-error=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyCode() {
    const code = draft.referralCode.trim();
    setCodeError(null);
    if (!code || !checkReferralCode) return;
    startCodeTransition(async () => {
      const result = await checkReferralCode(code);
      if (result.ok) {
        setCodePreview(result);
        setDraft((d) => ({ ...d, referralCode: result.code }));
      } else {
        setCodePreview(null);
        setCodeError(result.message);
      }
    });
  }

  function removeCode() {
    setCodePreview(null);
    setCodeError(null);
    setDraft((d) => ({ ...d, referralCode: "" }));
  }

  function handleSubmit() {
    setSubmitError(null);
    for (let i = 0; i < 4; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    if (!draft.termsAccepted) {
      setErrors({ termsAccepted: "Hizmet koşullarını onaylamalısın." });
      return;
    }
    const parsed = orderInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(flattenErrors(parsed.error));
      setSubmitError("Lütfen bilgilerini kontrol et.");
      return;
    }
    startTransition(async () => {
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      const referralCode = codeEnabled ? draft.referralCode.trim() : "";
      const result = await submit(referralCode ? { ...parsed.data, referralCode } : parsed.data);
      // Başarılı olursa sunucu yönlendirir; buraya yalnızca hata durumunda gelinir
      if (result && !result.ok) {
        setSubmitError(result.error);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        if (result.fieldErrors?.referralCode) {
          setCodePreview(null);
          setCodeError(result.fieldErrors.referralCode);
        }
        try {
          localStorage.setItem(draftKey, JSON.stringify({ draft, step }));
        } catch {}
      }
    });
  }

  function resetDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    setDraft(emptyDraft(defaultArtistName, pkg));
    setStep(0);
    setRestored(false);
    setErrors({});
  }

  const e = errors;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <Stepper current={step} onSelect={(i) => i < step && setStep(i)} />

        {restored && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-soft bg-brand-tint px-4 py-2.5 text-sm text-brand-ink">
            <span>Kaldığın yerden devam ediyorsun.</span>
            <button type="button" onClick={resetDraft} className="font-semibold underline-offset-2 hover:underline">
              Baştan başla
            </button>
          </div>
        )}

        <div className="rounded-[1.4rem] border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-8">
          {step === 0 && (
            <section aria-labelledby="adim-sarki" className="space-y-6">
              <StepTitle id="adim-sarki" title="Şarkı bilgileri" description="Videosu hazırlanacak şarkıyı tanıyalım." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Sanatçı adı" htmlFor="artistName" error={e["song.artistName"]}>
                  <Input id="artistName" value={draft.song.artistName} onChange={(ev) => update("song", { artistName: ev.target.value })} aria-invalid={!!e["song.artistName"]} />
                </Field>
                <Field label="Şarkı adı" htmlFor="title" error={e["song.title"]}>
                  <Input id="title" value={draft.song.title} onChange={(ev) => update("song", { title: ev.target.value })} aria-invalid={!!e["song.title"]} />
                </Field>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink">Şarkının yayınlanma durumu</legend>
                <div className="flex flex-wrap gap-2" data-error={!!e["song.releaseStatus"]}>
                  {RELEASE_STATUSES.map((rs) => (
                    <Chip key={rs} active={draft.song.releaseStatus === rs} onClick={() => update("song", { releaseStatus: rs })}>
                      {t.enums.releaseStatus[rs]}
                    </Chip>
                  ))}
                </div>
                {e["song.releaseStatus"] && <p className="mt-1.5 text-sm text-danger">{e["song.releaseStatus"]}</p>}
              </fieldset>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Şarkı dili" htmlFor="language" error={e["song.language"]}>
                  <Select id="language" value={draft.song.language} onChange={(ev) => update("song", { language: ev.target.value })}>
                    {SONG_LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
                {draft.song.language === "Diğer" && (
                  <Field label="Dil" htmlFor="languageOther" error={e["song.language"]}>
                    <Input id="languageOther" value={draft.song.languageOther} onChange={(ev) => update("song", { languageOther: ev.target.value })} aria-invalid={!!e["song.language"]} />
                  </Field>
                )}
              </div>

              <FileUploader
                kind="SONG_AUDIO"
                rule={rules.SONG_AUDIO}
                label="Şarkı dosyası (WAV veya MP3)"
                description="Dosyan hazır değilse bu adımı geçebilir, siparişten sonra panelden yükleyebilirsin."
                files={draft.uploads.SONG_AUDIO ?? []}
                onChange={setUploads("SONG_AUDIO")}
              />

              <Field label="Şarkı sözleri" htmlFor="lyrics" error={e["song.lyrics"]} hint="Sözleri satır satır yapıştır. İstersen aşağıdan dosya olarak da yükleyebilirsin.">
                <Textarea
                  id="lyrics"
                  rows={8}
                  value={draft.song.lyrics}
                  onChange={(ev) => update("song", { lyrics: ev.target.value })}
                  placeholder={"Birinci satır\nİkinci satır\n…"}
                />
              </Field>
              <FileUploader
                kind="LYRICS"
                rule={rules.LYRICS}
                label="Şarkı sözü dosyası"
                description="TXT, PDF veya DOCX. İsteğe bağlı."
                files={draft.uploads.LYRICS ?? []}
                onChange={setUploads("LYRICS")}
              />

              <Field label="Spotify veya diğer platform bağlantısı" htmlFor="streamingUrl" optional error={e["song.streamingUrl"]}>
                <Input
                  id="streamingUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://open.spotify.com/…"
                  value={draft.song.streamingUrl}
                  onChange={(ev) => update("song", { streamingUrl: ev.target.value })}
                  aria-invalid={!!e["song.streamingUrl"]}
                />
              </Field>
            </section>
          )}

          {step === 1 && (
            <section aria-labelledby="adim-tarz" className="space-y-6">
              <StepTitle id="adim-tarz" title="Video tercihleri" description="Şarkına yakışan görsel tarzı seç." />
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Video tarzı" data-error={!!e["style.style"]}>
                {VIDEO_STYLES.map((s) => {
                  const included = pkg.includedStyles.includes(s);
                  const Icon = STYLE_META[s].icon;
                  const active = draft.style.style === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!included}
                      onClick={() => update("style", { style: s })}
                      className={cn(
                        "relative flex gap-3 rounded-2xl border p-4 text-left transition-[border-color,box-shadow]",
                        active ? "border-brand shadow-[var(--shadow-focus)]" : "border-line hover:border-line-strong",
                        !included && "cursor-not-allowed opacity-55",
                      )}
                    >
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-lime text-ink" : "bg-brand-tint text-brand")}>
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">{t.enums.videoStyle[s]}</span>
                        <span className="mt-0.5 block text-sm text-muted">{STYLE_META[s].description}</span>
                        {!included && <span className="mt-1.5 block text-xs font-semibold text-warning">{t.common.notIncluded}</span>}
                      </span>
                      {active && <Check className="absolute right-3 top-3 size-4 text-brand" aria-hidden />}
                    </button>
                  );
                })}
              </div>
              {e["style.style"] && <p className="text-sm text-danger">{e["style.style"]}</p>}

              {draft.style.style === "FILM_EDIT" && (
                <fieldset className="rounded-2xl border border-line bg-canvas p-4 sm:p-5" data-error={!!e["style.footageSource"]}>
                  <legend className="px-1 text-sm font-semibold text-ink">Film görüntüleri nereden gelsin?</legend>
                  <div className="mt-2 space-y-2">
                    {FOOTAGE_SOURCES.map((src) => (
                      <label key={src} className="flex cursor-pointer items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-line">
                        <input
                          type="radio"
                          name="footageSource"
                          className="mt-1 accent-brand"
                          checked={draft.style.footageSource === src}
                          onChange={() => update("style", { footageSource: src })}
                        />
                        <span className="text-sm text-ink">{t.enums.footageSource[src]}</span>
                      </label>
                    ))}
                  </div>
                  {e["style.footageSource"] && <p className="mt-2 text-sm text-danger">{e["style.footageSource"]}</p>}
                  <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                    Telif hakkıyla korunan film sahnelerini izinsiz kullanmıyoruz. Yalnızca lisanslı stok görüntüler veya kullanım hakkına sahip
                    olduğun görüntüler kullanılır.
                  </p>
                </fieldset>
              )}

              {draft.style.style === "CUSTOM" && (
                <Field label="Özel tasarım talebin" htmlFor="customStyleRequest" error={e["style.customStyleRequest"]}>
                  <Textarea
                    id="customStyleRequest"
                    value={draft.style.customStyleRequest}
                    onChange={(ev) => update("style", { customStyleRequest: ev.target.value })}
                    aria-invalid={!!e["style.customStyleRequest"]}
                    placeholder="Nasıl bir video hayal ettiğini anlat: atmosfer, renkler, geçişler…"
                  />
                </Field>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Font tercihi" htmlFor="fontPreference" optional error={e["style.fontPreference"]}>
                  <Input id="fontPreference" value={draft.style.fontPreference} onChange={(ev) => update("style", { fontPreference: ev.target.value })} placeholder="Örn. kalın ve köşeli, el yazısı…" />
                </Field>
                <Field label="Renk tercihi" htmlFor="colorPreference" optional error={e["style.colorPreference"]}>
                  <Input id="colorPreference" value={draft.style.colorPreference} onChange={(ev) => update("style", { colorPreference: ev.target.value })} placeholder="Örn. siyah-beyaz, sıcak tonlar…" />
                </Field>
              </div>
              <Field label="Referans video bağlantısı" htmlFor="referenceUrl" optional error={e["style.referenceUrl"]}>
                <Input
                  id="referenceUrl"
                  type="url"
                  inputMode="url"
                  value={draft.style.referenceUrl}
                  onChange={(ev) => update("style", { referenceUrl: ev.target.value })}
                  aria-invalid={!!e["style.referenceUrl"]}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Editöre özel açıklamalar" htmlFor="notesForEditor" optional error={e["style.notesForEditor"]}>
                <Textarea id="notesForEditor" value={draft.style.notesForEditor} onChange={(ev) => update("style", { notesForEditor: ev.target.value })} />
              </Field>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="adim-format" className="space-y-7">
              <StepTitle id="adim-format" title="Format ve platform" description="Videoların hangi formatlarda ve nerede yayınlanacak?" />
              <fieldset data-error={!!e["format.formats"]}>
                <legend className="mb-2 text-sm font-semibold text-ink">Video formatları</legend>
                <div className="grid grid-cols-3 gap-3">
                  {VIDEO_FORMATS.map((f) => {
                    const included = pkg.includedFormats.includes(f);
                    const active = draft.format.formats.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        disabled={!included}
                        onClick={() =>
                          update("format", {
                            formats: active ? draft.format.formats.filter((x) => x !== f) : [...draft.format.formats, f],
                          })
                        }
                        className={cn(
                          "flex flex-col items-center gap-3 rounded-2xl border px-2 py-4 text-center transition-[border-color,box-shadow]",
                          active ? "border-brand shadow-[var(--shadow-focus)]" : "border-line hover:border-line-strong",
                          !included && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span className="flex h-12 items-center">
                          <span
                            className={cn(
                              "block rounded-md border-2",
                              active ? "border-brand bg-brand-soft" : "border-line-strong bg-canvas",
                              f === "VERTICAL" && "h-12 w-7",
                              f === "HORIZONTAL" && "h-7 w-12",
                              f === "SQUARE" && "size-10",
                            )}
                          />
                        </span>
                        <span className="text-sm font-semibold text-ink">{t.enums.videoFormat[f]}</span>
                        {!included && <span className="text-[11px] font-semibold text-warning">{t.common.notIncluded}</span>}
                      </button>
                    );
                  })}
                </div>
                {e["format.formats"] && <p className="mt-2 text-sm text-danger">{e["format.formats"]}</p>}
              </fieldset>

              <fieldset data-error={!!e["format.platforms"]}>
                <legend className="mb-2 text-sm font-semibold text-ink">Hedef platformlar</legend>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const active = draft.format.platforms.includes(p);
                    return (
                      <Chip
                        key={p}
                        active={active}
                        onClick={() =>
                          update("format", {
                            platforms: active ? draft.format.platforms.filter((x) => x !== p) : [...draft.format.platforms, p],
                          })
                        }
                      >
                        {t.enums.platform[p]}
                      </Chip>
                    );
                  })}
                </div>
                {e["format.platforms"] && <p className="mt-2 text-sm text-danger">{e["format.platforms"]}</p>}
                {draft.format.platforms.includes("OTHER") && (
                  <Field label="Diğer platform" htmlFor="otherPlatform" error={e["format.otherPlatform"]} className="mt-4">
                    <Input id="otherPlatform" value={draft.format.otherPlatform} onChange={(ev) => update("format", { otherPlatform: ev.target.value })} aria-invalid={!!e["format.otherPlatform"]} />
                  </Field>
                )}
              </fieldset>

              <div data-error={!!e["format.videoCount"]}>
                <p className="mb-1 text-sm font-semibold text-ink">Bu şarkı için kaç video hazırlansın?</p>
                <p className="mb-3 text-sm text-muted">
                  {mode === "purchase"
                    ? `Paketinde toplam ${pkg.totalVideos} video var${pkg.bonusVideos ? ` (${pkg.bonusVideos} bonus dahil)` : ""}. Kalan haklarını paket süresi içinde başka şarkıların için kullanabilirsin.`
                    : `Paketinde ${pkg.maxVideosForOrder} video hakkın kaldı.`}
                </p>
                <div className="inline-flex items-center gap-1 rounded-2xl border border-line bg-card p-1.5">
                  <button
                    type="button"
                    onClick={() => update("format", { videoCount: Math.max(1, draft.format.videoCount - 1) })}
                    className="flex size-10 items-center justify-center rounded-xl text-ink hover:bg-canvas disabled:opacity-40"
                    disabled={draft.format.videoCount <= 1}
                    aria-label="Azalt"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="min-w-16 text-center font-display text-xl font-bold text-ink" aria-live="polite">
                    {draft.format.videoCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => update("format", { videoCount: Math.min(pkg.maxVideosForOrder, draft.format.videoCount + 1) })}
                    className="flex size-10 items-center justify-center rounded-xl text-ink hover:bg-canvas disabled:opacity-40"
                    disabled={draft.format.videoCount >= pkg.maxVideosForOrder}
                    aria-label="Artır"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                {e["format.videoCount"] && <p className="mt-2 text-sm text-danger">{e["format.videoCount"]}</p>}
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="adim-dosya" className="space-y-6">
              <StepTitle id="adim-dosya" title="Dosya yükleme" description="Klibini, görüntülerini veya ek görsellerini ekle. Hazır değilse sonra da yükleyebilirsin." />
              {draft.style.style === "MUSIC_VIDEO" && (
                <FileUploader
                  kind="MUSIC_VIDEO"
                  rule={rules.MUSIC_VIDEO}
                  label="Müzik klibin (MP4 veya MOV)"
                  description="Sözler bu klibin üzerine senkronize edilecek."
                  files={draft.uploads.MUSIC_VIDEO ?? []}
                  onChange={setUploads("MUSIC_VIDEO")}
                />
              )}
              {draft.style.style === "FILM_EDIT" && draft.style.footageSource === "CUSTOMER_PROVIDED" && (
                <FileUploader
                  kind="FOOTAGE"
                  rule={rules.FOOTAGE}
                  label="Kullanılacak görüntüler"
                  description="Yalnızca kullanım hakkına sahip olduğun görüntüleri yükle."
                  multiple
                  maxFiles={10}
                  files={draft.uploads.FOOTAGE ?? []}
                  onChange={setUploads("FOOTAGE")}
                />
              )}
              <FileUploader
                kind="IMAGE"
                rule={rules.IMAGE}
                label="Ek görseller"
                description="Kapak görseli, fotoğraf veya logo gibi kullanılmasını istediğin görseller. İsteğe bağlı."
                multiple
                maxFiles={10}
                files={draft.uploads.IMAGE ?? []}
                onChange={setUploads("IMAGE")}
              />

              <RequirementList missing={missing} />

              <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5" data-error={!!e.rightsConfirmed}>
                <Checkbox
                  checked={draft.rightsConfirmed}
                  onChange={(ev) => setDraft((d) => ({ ...d, rightsConfirmed: ev.target.checked }))}
                  label="Gönderdiğim şarkı, şarkı sözleri, müzik klibi, görüntü ve görseller üzerinde gerekli kullanım haklarına sahip olduğumu onaylıyorum."
                  description="Üçüncü kişilere ait içeriklerin izinsiz kullanımından doğabilecek sorumluluk müşteriye aittir."
                />
                {e.rightsConfirmed && <p className="mt-2 text-sm text-danger">{e.rightsConfirmed}</p>}
              </div>
            </section>
          )}

          {step === 4 && (
            <section aria-labelledby="adim-ozet" className="space-y-6">
              <StepTitle id="adim-ozet" title="Sipariş özeti" description="Bilgilerini kontrol et ve siparişini onayla." />
              <SummaryList draft={draft} pkg={pkg} mode={mode} codePreview={codePreview} />
              {codeEnabled && (
                <ReferralCodeBox
                  value={draft.referralCode}
                  onChange={(v) => {
                    setDraft((d) => ({ ...d, referralCode: v }));
                    setCodeError(null);
                  }}
                  onApply={applyCode}
                  onRemove={removeCode}
                  preview={codePreview}
                  error={codeError}
                  pending={codePending}
                />
              )}
              <RequirementList missing={missing} compact />
              <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5" data-error={!!e.termsAccepted}>
                <Checkbox
                  checked={draft.termsAccepted}
                  onChange={(ev) => setDraft((d) => ({ ...d, termsAccepted: ev.target.checked }))}
                  label={
                    <>
                      <Link href="/kullanim-kosullari" target="_blank" className="font-semibold text-brand hover:underline">
                        Kullanım Koşulları
                      </Link>{" "}
                      ile paket kapsamını ve teslimat koşullarını okudum, kabul ediyorum. Paketlerde revizyon hakkı bulunmadığını biliyorum.
                    </>
                  }
                  description={
                    <>
                      Kişisel verilerin{" "}
                      <Link href="/kvkk-aydinlatma-metni" target="_blank" className="underline">
                        KVKK Aydınlatma Metni
                      </Link>{" "}
                      kapsamında işlenir.
                    </>
                  }
                />
                {e.termsAccepted && <p className="mt-2 text-sm text-danger">{e.termsAccepted}</p>}
              </div>
              {mode === "purchase" && (
                <p className="flex gap-2 text-sm text-muted">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Onayladıktan sonra fatura bilgilerini girip güvenli ödeme sayfasına geçeceksin. Paket haklarını ödeme onaylandığında tanımlarız.
                </p>
              )}
            </section>
          )}

          {submitError && (
            <Alert tone="danger" className="mt-6">
              {submitError}
            </Alert>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={goBack} icon={<ArrowLeft className="size-4" aria-hidden />}>
                Geri
              </Button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" size="lg" onClick={goNext}>
                Devam Et <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={handleSubmit} disabled={pending}>
                {pending ? "Gönderiliyor…" : mode === "purchase" ? "Siparişi Onayla ve Ödemeye Geç" : "Siparişi Oluştur"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24">
        <OrderSidebar pkg={pkg} mode={mode} videoCount={draft.format.videoCount} codePreview={codePreview} codeHint={codeEnabled && step < STEPS.length - 1} />
      </aside>
    </div>
  );
}

// ───────────────────────────── Yardımcı bileşenler ─────────────────────────────

function Stepper({ current, onSelect }: { current: number; onSelect: (i: number) => void }) {
  return (
    <nav aria-label="Sipariş adımları" className="mb-6">
      <p className="mb-3 text-sm font-semibold text-muted sm:hidden">
        Adım {current + 1} / {STEPS.length}: <span className="text-ink">{STEPS[current]!.label}</span>
      </p>
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(i)}
                disabled={!done}
                aria-current={active ? "step" : undefined}
                aria-label={`Adım ${i + 1}: ${s.label}${done ? " (tamamlandı)" : ""}`}
                className="flex items-center gap-2 disabled:cursor-default"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                    done && "bg-lime text-ink",
                    active && "bg-lime text-ink ring-4 ring-brand-soft",
                    !done && !active && "bg-card text-muted ring-1 ring-line",
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                <span className={cn("hidden text-sm font-semibold sm:inline", active ? "text-ink" : "text-muted")}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className={cn("h-0.5 flex-1 rounded-full", i < current ? "bg-brand" : "bg-line")} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepTitle({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div>
      <h2 id={id} className="text-xl font-bold text-ink sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1 text-muted">{description}</p>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-lime text-ink ring-1 ring-[#c4e534]" : "bg-card text-ink-soft ring-1 ring-line hover:ring-brand-soft",
      )}
    >
      {children}
    </button>
  );
}

function RequirementList({ missing, compact = false }: { missing: ReturnType<typeof missingRequiredItems>; compact?: boolean }) {
  if (!missing.length) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-[#166534]">
        <FileCheck2 className="size-4" aria-hidden /> Üretim için gerekli dosyalar tamam.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-[#fde68a] bg-warning-soft px-4 py-3 text-sm text-[#78350f]">
      <p className="font-semibold">{compact ? "Eksik dosyalar" : "Üretime başlamak için gerekenler"}</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        {missing.map((m) => (
          <li key={m}>{REQUIRED_ITEM_LABELS[m]}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs">Eksikleri sipariş sonrasında müşteri panelinden yükleyebilirsin; siparişin &quot;Dosya Bekleniyor&quot; durumunda bekler.</p>
    </div>
  );
}

function ReferralCodeBox({
  value,
  onChange,
  onApply,
  onRemove,
  preview,
  error,
  pending,
}: {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
  preview: CodePreview | null;
  error: string | null;
  pending: boolean;
}) {
  if (preview) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-success-soft px-4 py-3 text-sm text-[#166534]" role="status">
        <span className="flex items-center gap-2 font-semibold">
          <TicketPercent className="size-4 shrink-0" aria-hidden /> {preview.code} uygulandı: −{preview.discountLabel} · Ödenecek {preview.totalLabel}
        </span>
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs font-semibold hover:underline">
          <X className="size-3.5" aria-hidden /> Kaldır
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5" data-error={!!error}>
      <label htmlFor="referralCode" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <TicketPercent className="size-4 text-brand" aria-hidden /> Referans veya indirim kodun var mı?
      </label>
      <p className="mt-1 text-xs text-muted">İş ortaklarımızdan veya bir kampanyadan aldığın kodu yaz; indirim toplam tutara hemen yansır.</p>
      <div className="mt-3 flex gap-2">
        <Input
          id="referralCode"
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              onApply();
            }
          }}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={30}
          placeholder="KOD"
          className="uppercase"
          aria-invalid={!!error}
          aria-describedby={error ? "referralCode-error" : undefined}
        />
        <Button type="button" variant="secondary" size="sm" onClick={onApply} disabled={pending || !value.trim()} className="shrink-0">
          {pending ? "…" : "Uygula"}
        </Button>
      </div>
      {error && (
        <p id="referralCode-error" className="mt-2 text-xs text-danger" role="status">
          {error}
        </p>
      )}
    </div>
  );
}

function SummaryList({ draft, pkg, mode, codePreview }: { draft: Draft; pkg: WizardPackage; mode: "purchase" | "entitlement"; codePreview: CodePreview | null }) {
  const files = Object.entries(draft.uploads).flatMap(([kind, list]) => (list ?? []).map((f) => ({ ...f, kind: kind as CustomerFileKind })));
  const rows: Array<[string, React.ReactNode]> = [
    ["Seçilen paket", `${pkg.name}${pkg.isSample ? " (örnek veri)" : ""}`],
    ["Paket süresi", `${pkg.durationMonths} ay`],
    ["Video adedi", mode === "purchase" ? `Bu şarkı için ${draft.format.videoCount} · pakette toplam ${pkg.totalVideos}${pkg.bonusVideos ? ` (${pkg.bonusVideos} bonus dahil)` : ""}` : `${draft.format.videoCount} video`],
    ...(mode === "purchase" && pkg.priceKurus != null
      ? ([
          [
            "Toplam ücret",
            codePreview ? (
              <span key="p">
                <s className="text-muted">{codePreview.listLabel}</s> <strong>{codePreview.totalLabel}</strong>{" "}
                <span className="text-success">
                  ({codePreview.code} ile −{codePreview.discountLabel})
                </span>
              </span>
            ) : (
              <strong key="p">{formatMoney(pkg.priceKurus, pkg.currency)}</strong>
            ),
          ],
          ["Video başına maliyet", formatMoney(Math.round(pkg.priceKurus / pkg.totalVideos), pkg.currency)],
        ] as Array<[string, React.ReactNode]>)
      : []),
    ["Şarkı", `${draft.song.artistName} – ${draft.song.title}`],
    ["Görsel tarz", draft.style.style ? t.enums.videoStyle[draft.style.style] : "—"],
    ["Video formatları", draft.format.formats.map((f) => t.enums.videoFormat[f]).join(", ")],
    [
      "Platformlar",
      draft.format.platforms.map((p) => (p === "OTHER" && draft.format.otherPlatform ? draft.format.otherPlatform : t.enums.platform[p])).join(", "),
    ],
    ["Hazırlık süreci", `${PREPARATION_TEXT} ${NO_REVISION_TEXT}`],
    ["Teslimat", pkg.deliveryTerms],
    ["Dosyalar", files.length ? files.map((f) => `${t.enums.fileKind[f.kind]}: ${f.name}`).join(" · ") : "Henüz dosya yüklenmedi"],
  ];
  return (
    <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
          <dt className="text-sm font-medium text-muted">{k}</dt>
          <dd className="break-words text-sm text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function OrderSidebar({
  pkg,
  mode,
  videoCount,
  codePreview,
  codeHint,
}: {
  pkg: WizardPackage;
  mode: "purchase" | "entitlement";
  videoCount: number;
  codePreview: CodePreview | null;
  codeHint: boolean;
}) {
  return (
    <div className="rounded-[1.4rem] border border-line bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{mode === "purchase" ? "Seçilen paket" : "Kullanılan paket"}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <p className="font-display text-xl font-bold text-ink">{pkg.name}</p>
        {pkg.isSample && <Badge tone="warning">Örnek veri</Badge>}
      </div>
      {mode === "purchase" && pkg.priceKurus != null ? (
        <>
          {codePreview ? (
            <>
              <p className="mt-4 text-sm text-muted line-through">{codePreview.listLabel}</p>
              <p className="font-display text-3xl font-extrabold text-ink">{codePreview.totalLabel}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-success">
                <TicketPercent className="size-4" aria-hidden /> {codePreview.code}: −{codePreview.discountLabel}
              </p>
            </>
          ) : (
            <p className="mt-4 font-display text-3xl font-extrabold text-ink">{formatMoney(pkg.priceKurus, pkg.currency)}</p>
          )}
          <p className="mt-1 text-sm text-muted">Tek seferlik ödeme · otomatik yenileme yok</p>
          {codeHint && !codePreview && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-ink-soft">
              <TicketPercent className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <span>
                Referans veya indirim kodun varsa son adımda (<strong>Özet</strong>) girebilirsin.
              </span>
            </p>
          )}
          <div className="mt-4 rounded-xl bg-brand-tint px-4 py-3 text-sm text-brand-ink">
            Video başına <strong>{formatMoney(Math.round(pkg.priceKurus / pkg.totalVideos), pkg.currency)}</strong>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Kalan hak: <strong className="text-ink">{pkg.maxVideosForOrder} video</strong>
          {pkg.endsAtLabel && <> · bitiş {pkg.endsAtLabel}</>}
        </p>
      )}
      <ul className="mt-5 space-y-2 text-sm text-ink-soft">
        <li className="flex justify-between gap-4">
          <span>Süre</span>
          <span className="font-semibold text-ink">{pkg.durationMonths} ay</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Toplam video</span>
          <span className="font-semibold text-ink">
            {pkg.totalVideos}
            {pkg.bonusVideos > 0 && <span className="font-normal text-success"> ({pkg.bonusVideos} bonus)</span>}
          </span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Bu siparişte</span>
          <span className="font-semibold text-ink">{videoCount} video</span>
        </li>
      </ul>
      <p className="mt-5 flex gap-2 border-t border-line pt-4 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        Videolar insan editörler tarafından hazırlanır. İzlenme veya dinlenme garantisi verilmez.
      </p>
    </div>
  );
}
