// Ücretsiz deneme: aşamalar, etiketler ve saf iş kuralları (istemci + sunucu).
import { monthlyAllocation } from "./delivery-plan";
import type { VideoStyleValue } from "./enums";

export const TRIAL_STAGES = [
  "RECEIVED",
  "FILES_CHECK",
  "NEEDS_INFO",
  "QUEUED",
  "IN_PRODUCTION",
  "EDITOR_REVIEW",
  "PREVIEW_READY",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type TrialStageValue = (typeof TRIAL_STAGES)[number];

export const TRIAL_STAGE_LABEL: Record<TrialStageValue, string> = {
  RECEIVED: "Başvuru alındı",
  FILES_CHECK: "Dosyalar kontrol ediliyor",
  NEEDS_INFO: "Eksik bilgi bekleniyor",
  QUEUED: "Üretim kuyruğunda",
  IN_PRODUCTION: "Üretimde",
  EDITOR_REVIEW: "Editör kontrolünde",
  PREVIEW_READY: "Ön izleme hazır",
  COMPLETED: "Tamamlandı",
  FAILED: "Hata oluştu",
  CANCELLED: "İptal edildi",
};

export const TRIAL_STAGE_TONE: Record<TrialStageValue, "neutral" | "info" | "warning" | "success" | "danger" | "brand"> = {
  RECEIVED: "info",
  FILES_CHECK: "info",
  NEEDS_INFO: "warning",
  QUEUED: "neutral",
  IN_PRODUCTION: "brand",
  EDITOR_REVIEW: "brand",
  PREVIEW_READY: "success",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

/** Müşteriye gösterilen süreç adımları (ücretsiz deneme akışı) */
export const TRIAL_JOURNEY = [
  { title: "Dosyalarını ve sözlerini gönder", text: "Ses dosyan, şarkı sözlerin ve varsa görsel materyallerin." },
  { title: "Dosyaların kontrol edilsin", text: "Ekibimiz dosyaların üretime uygun olduğunu ve sözlerin şarkıyla eşleştiğini kontrol eder." },
  { title: "Üç örnek video hazırlansın", text: "Editörlerimiz aynı şarkı için üç farklı yaklaşım hazırlar." },
  { title: "Ön izlemeleri incele", text: "Her videonun kısa, filigranlı ön izlemesini panelinde karşılaştır." },
  { title: "Beğenirsen paketini al", text: "Ödeme onaylanınca üç videonun tam ve temiz sürümleri açılır." },
  { title: "Teslimatı takip et", text: "Paketindeki diğer videoların teslim tarihleri panelinde görünür." },
] as const;

/** Başvurunun müşteri tarafındaki adım indeksi (0–5) */
export function trialJourneyStep(status: TrialStageValue, converted: boolean) {
  if (converted) return 5;
  switch (status) {
    case "RECEIVED":
    case "FILES_CHECK":
    case "NEEDS_INFO":
      return 1;
    case "QUEUED":
    case "IN_PRODUCTION":
    case "EDITOR_REVIEW":
    case "FAILED":
      return 2;
    case "PREVIEW_READY":
      return 3;
    case "COMPLETED":
      return 5;
    default:
      return 0;
  }
}

export const TRIAL_VIDEO_COUNT = 3;

const APPROACH: Record<VideoStyleValue, string> = {
  FILM_EDIT: "Film Edit — sinematik görüntülerle",
  MINIMAL: "Minimal — güçlü tipografi, sade zemin",
  MUSIC_VIDEO: "Music Video — kendi klibinin üzerine sözler",
  CUSTOM: "Özel yaklaşım — notlarındaki tarife göre",
};

/**
 * Üç deneme videosu için birbirinden farklı yaklaşımlar önerir.
 * Klip yüklenmişse üçüncü video klip üzerine sözlerdir; yoksa özel/karma bir yaklaşım seçilir.
 */
export function proposeTrialApproaches(input: { hasMusicVideo: boolean; preferred?: VideoStyleValue | null }) {
  const base: VideoStyleValue[] = ["FILM_EDIT", "MINIMAL", input.hasMusicVideo ? "MUSIC_VIDEO" : "CUSTOM"];
  // Müşterinin tercih ettiği tarz ilk sıraya alınır (kapsamdaysa)
  if (input.preferred && base.includes(input.preferred)) {
    base.splice(base.indexOf(input.preferred), 1);
    base.unshift(input.preferred);
  }
  return base.map((style, i) => ({ sequence: i + 1, style, approach: APPROACH[style] }));
}

/**
 * Videoların durumlarından başvurunun üretim aşamasını hesaplar.
 * (Dosya kontrolü öncesi aşamalar ve iptal/tamamlanma başvuru düzeyinde yönetilir.)
 */
export function aggregateTrialStage(videoStages: TrialStageValue[]): TrialStageValue {
  if (!videoStages.length) return "QUEUED";
  if (videoStages.some((s) => s === "FAILED")) return "FAILED";
  if (videoStages.every((s) => s === "COMPLETED")) return "COMPLETED";
  if (videoStages.every((s) => s === "PREVIEW_READY" || s === "COMPLETED")) return "PREVIEW_READY";
  if (videoStages.some((s) => s === "IN_PRODUCTION" || s === "EDITOR_REVIEW" || s === "PREVIEW_READY")) return "IN_PRODUCTION";
  return "QUEUED";
}

/** Video aşamaları arasında yöneticinin yapabileceği geçişler */
export const TRIAL_VIDEO_TRANSITIONS: Partial<Record<TrialStageValue, TrialStageValue[]>> = {
  QUEUED: ["IN_PRODUCTION", "FAILED"],
  IN_PRODUCTION: ["EDITOR_REVIEW", "QUEUED", "FAILED"],
  EDITOR_REVIEW: ["IN_PRODUCTION", "FAILED"],
  PREVIEW_READY: ["EDITOR_REVIEW"],
  FAILED: ["QUEUED"],
};

export function canMoveTrialVideo(from: TrialStageValue, to: TrialStageValue) {
  return (TRIAL_VIDEO_TRANSITIONS[from] ?? []).includes(to);
}

/** Lyrics metni için asgari üretim kontrolleri (otomatik dosya kontrolünün bir parçası) */
export function checkLyricsText(text: string | null | undefined) {
  const t = (text ?? "").trim();
  const lines = t.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const problems: string[] = [];
  if (t.length < 20) problems.push("Şarkı sözleri çok kısa görünüyor (en az 20 karakter).");
  if (lines.length < 2) problems.push("Sözleri satır satır yaz; en az 2 satır olmalı.");
  if (t.length > 20000) problems.push("Şarkı sözleri 20.000 karakteri aşamaz.");
  return problems;
}

/**
 * Denemeden satın almada video hesabı (paket kuralına göre, sabit kodlanmamış):
 *  - Deneme videoları pakete dahilse: ilk teslimdeki videolardan 3'ü deneme videolarıdır.
 *    Ör. 30 videoluk pakette 3 deneme + 27 yeni video = toplam 30 farklı video.
 *  - Dahil değilse: deneme videoları pakete ek sayılır (toplam hak = paket + 3).
 */
export function trialConversionPlan(input: { videoCount: number; bonusVideoCount: number; durationMonths: number; countsTowardPackage: boolean }) {
  const allocation = monthlyAllocation(input.videoCount, input.bonusVideoCount, input.durationMonths);
  const packageTotal = input.videoCount + Math.max(0, input.bonusVideoCount);
  const firstBatch = allocation[0] ?? packageTotal;
  if (input.countsTowardPackage) {
    const orderVideoCount = Math.min(packageTotal, Math.max(firstBatch, TRIAL_VIDEO_COUNT));
    return {
      firstBatch,
      orderVideoCount,
      trialVideos: TRIAL_VIDEO_COUNT,
      newVideos: orderVideoCount - TRIAL_VIDEO_COUNT,
      entitlementTotal: packageTotal,
      packageTotal,
    };
  }
  return {
    firstBatch,
    orderVideoCount: firstBatch + TRIAL_VIDEO_COUNT,
    trialVideos: TRIAL_VIDEO_COUNT,
    newVideos: firstBatch,
    entitlementTotal: packageTotal + TRIAL_VIDEO_COUNT,
    packageTotal,
  };
}
