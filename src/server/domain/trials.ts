import "server-only";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Prisma, TrialStage } from "@prisma/client";
import { CUSTOMER_FILE_KINDS } from "@/lib/enums";
import { formatDateTime } from "@/lib/dates";
import {
  aggregateTrialStage,
  canMoveTrialVideo,
  checkLyricsText,
  proposeTrialApproaches,
  TRIAL_STAGE_LABEL,
  TRIAL_VIDEO_COUNT,
  type TrialStageValue,
} from "@/lib/trial";
import type { TrialInput } from "@/lib/validation";
import { audit } from "../audit";
import { db, type Tx } from "../db";
import { notifyAdmins, notifyUser } from "../notify";
import { buildStorageKey, storage } from "../storage";
import { readSystemSetting } from "../system-settings";
import { buildPosterArgs, buildPreviewPlan, ffmpegCapabilities, runFfmpeg, watermarkFile } from "../video/ffmpeg";
import { DomainError, isUniqueViolation } from "./errors";

export const TRIAL_TERMS_VERSION = "2026-10-deneme-taslak-1";

/** Açık (henüz sonuçlanmamış) deneme aşamaları — kapasite hesabında kullanılır */
const OPEN_STAGES: TrialStage[] = ["RECEIVED", "FILES_CHECK", "NEEDS_INFO", "QUEUED", "IN_PRODUCTION", "EDITOR_REVIEW", "FAILED"];
/** Müşterinin dosya ekleyip düzenleyebildiği aşamalar */
export const TRIAL_EDITABLE_STAGES: TrialStage[] = ["RECEIVED", "FILES_CHECK", "NEEDS_INFO"];

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function trialNumber(date = new Date()) {
  let suffix = "";
  for (const b of randomBytes(6)) suffix += ALPHABET[b % 32];
  return `DN-${String(date.getUTCFullYear()).slice(2)}${String(date.getUTCMonth() + 1).padStart(2, "0")}-${suffix}`;
}

async function event(client: Tx | typeof db, trialId: string, type: string, message: string, actorId: string | null, visibleToCustomer = true) {
  await client.trialEvent.create({ data: { trialId, type, message, actorId, visibleToCustomer } });
}

// ───────────────────────────── Uygunluk ve otomatik kontrol ─────────────────────────────

export type TrialEligibility =
  | { ok: true }
  | { ok: false; reason: "DISABLED" | "CAPACITY" | "EXISTS" | "CUSTOMER" | "EMAIL" | "PHONE" | "LOGIN"; message: string };

/** Kullanıcının deneme başlatıp başlatamayacağı (arayüz ve sunucu aynı kuralı kullanır). */
export async function trialEligibility(userId: string | null): Promise<TrialEligibility> {
  const settings = await readSystemSetting("system.trial");
  if (!settings.enabled) return { ok: false, reason: "DISABLED", message: "Ücretsiz deneme şu an kapalı." };
  if (!userId) return { ok: false, reason: "LOGIN", message: "Devam etmek için hesap oluştur veya giriş yap." };
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      trialApplication: { select: { id: true } },
      _count: { select: { entitlements: true } },
    },
  });
  if (user.trialApplication) return { ok: false, reason: "EXISTS", message: "Ücretsiz denemeni zaten başlattın." };
  if (user._count.entitlements > 0) {
    return { ok: false, reason: "CUSTOMER", message: "Ücretsiz deneme yalnızca henüz paket satın almamış kullanıcılar içindir." };
  }
  const open = await db.trialApplication.count({ where: { status: { in: OPEN_STAGES } } });
  if (open >= settings.maxOpenTrials) {
    return { ok: false, reason: "CAPACITY", message: "Deneme kapasitemiz şu an dolu. Lütfen daha sonra tekrar dene." };
  }
  if (!user.emailVerifiedAt) return { ok: false, reason: "EMAIL", message: "Önce e-posta adresini doğrula." };
  if (!user.phoneVerifiedAt) return { ok: false, reason: "PHONE", message: "Önce telefon numaranı doğrula." };
  return { ok: true };
}

export type TrialCheckReport = {
  ok: boolean;
  problems: string[];
  checkedAt: string;
  files: Array<{ kind: string; name: string; size: number }>;
};

/** Üretime alınmadan önce otomatik kontroller: zorunlu dosyalar, sözler, istenen tarza uygun materyal. */
export function automatedTrialCheck(input: {
  lyrics: string | null;
  files: Array<{ kind: string; originalName: string; sizeBytes: bigint | number; status: string }>;
  preferredStyle?: string | null;
  footageSource?: string | null;
}): TrialCheckReport {
  const uploaded = input.files.filter((f) => f.status === "UPLOADED");
  const problems: string[] = [];
  const audio = uploaded.filter((f) => f.kind === "SONG_AUDIO");
  if (!audio.length) problems.push("Şarkının ses dosyası (MP3/WAV) eksik.");
  if (audio.length > 1) problems.push("Yalnızca bir ses dosyası yükle; birden fazla şarkı sesi var.");
  for (const a of audio) {
    if (Number(a.sizeBytes) < 100 * 1024) problems.push(`"${a.originalName}" çok küçük görünüyor; tam şarkı dosyasını yükle.`);
  }
  problems.push(...checkLyricsText(input.lyrics));
  if (input.preferredStyle === "MUSIC_VIDEO" && !uploaded.some((f) => f.kind === "MUSIC_VIDEO")) {
    problems.push("Klip üzerine lyrics için müzik klibi dosyasını yükle.");
  }
  if (input.footageSource === "CUSTOMER_PROVIDED" && !uploaded.some((f) => f.kind === "FOOTAGE" || f.kind === "MUSIC_VIDEO")) {
    problems.push("Kendi görüntülerini kullanacağını seçtin; görüntü dosyalarını yükle.");
  }
  if (input.files.some((f) => f.status !== "UPLOADED")) problems.push("Bazı dosyaların yüklemesi tamamlanmamış.");
  return {
    ok: problems.length === 0,
    problems,
    checkedAt: new Date().toISOString(),
    files: uploaded.map((f) => ({ kind: f.kind, name: f.originalName, size: Number(f.sizeBytes) })),
  };
}

// ───────────────────────────── Başvuru ─────────────────────────────

export async function createTrialApplication(userId: string, input: TrialInput) {
  const eligibility = await trialEligibility(userId);
  if (!eligibility.ok) throw new DomainError(eligibility.message, `TRIAL_${eligibility.reason}`);

  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, phone: true } });
  const ids = [...new Set(input.fileIds)];
  const files = await db.uploadedFile.findMany({
    where: { id: { in: ids }, ownerId: userId, orderId: null, trialId: null, kind: { in: [...CUSTOMER_FILE_KINDS] }, status: { in: ["UPLOADED", "PENDING"] } },
    select: { id: true, kind: true, originalName: true, sizeBytes: true, status: true },
  });
  if (files.length !== ids.length) throw new DomainError("Bazı dosyalar bulunamadı. Lütfen dosyalarını kontrol et.", "FILES");

  const report = automatedTrialCheck({
    lyrics: input.song.lyrics,
    files,
    preferredStyle: input.preferredStyle,
    footageSource: input.footageSource,
  });
  // Eksik/hatalı başvuru oluşturulmaz ve kuyruğa alınmaz; müşteri neyi düzeltmesi gerektiğini görür
  if (!report.ok) throw new DomainError(`Başvurun henüz gönderilemedi:\n• ${report.problems.join("\n• ")}`, "TRIAL_CHECK");

  const approaches = proposeTrialApproaches({
    hasMusicVideo: files.some((f) => f.kind === "MUSIC_VIDEO"),
    preferred: input.preferredStyle ?? null,
  });

  let created: { id: string; number: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      created = await db.$transaction(async (tx) => {
        const song = await tx.song.create({
          data: {
            userId,
            artistName: input.song.artistName,
            title: input.song.title,
            releaseStatus: input.song.releaseStatus,
            language: input.song.language,
            lyrics: input.song.lyrics,
            streamingUrl: input.song.streamingUrl ?? null,
          },
        });
        const now = new Date();
        const trial = await tx.trialApplication.create({
          data: {
            number: trialNumber(now),
            userId,
            status: "FILES_CHECK",
            contactName: user.name,
            contactEmail: user.email,
            contactPhone: user.phone!,
            songId: song.id,
            formats: input.formats,
            footageSource: input.footageSource ?? null,
            notesForEditor: input.notesForEditor ?? null,
            termsVersion: TRIAL_TERMS_VERSION,
            rightsConfirmedAt: now,
            materialsMatchConfirmedAt: now,
            checkReport: report as unknown as Prisma.InputJsonValue,
          },
        });
        const { count } = await tx.uploadedFile.updateMany({
          where: { id: { in: ids }, orderId: null, trialId: null },
          data: { trialId: trial.id, songId: song.id },
        });
        if (count !== ids.length) throw new DomainError("Dosyalar başka bir başvuruya bağlanmış.", "FILES");
        await tx.trialVideo.createMany({
          data: approaches.map((a) => ({ trialId: trial.id, sequence: a.sequence, style: a.style, approach: a.approach, status: "RECEIVED" as const })),
        });
        await event(tx, trial.id, "CREATED", "Başvurun alındı. Dosyaların ekibimiz tarafından kontrol ediliyor.", userId);
        return { id: trial.id, number: trial.number };
      });
    } catch (err) {
      if (isUniqueViolation(err, "number")) continue;
      if (isUniqueViolation(err, "userId")) throw new DomainError("Ücretsiz denemeni zaten başlattın.", "TRIAL_EXISTS");
      throw err;
    }
  }
  if (!created) throw new DomainError("Başvuru oluşturulamadı, lütfen tekrar dene.");

  const settings = await readSystemSetting("system.trial");
  await notifyUser({
    userId,
    type: "TRIAL_UPDATE",
    title: `Deneme başvurun alındı (${created.number})`,
    body: `Dosyaların kontrol ediliyor. Kontrol tamamlandıktan sonra ön izlemelerin için hedefimiz ${settings.previewTargetHours} saat.`,
    email: {
      subject: `Ücretsiz deneme başvurun alındı (${created.number})`,
      paragraphs: [
        "Başvurun ve dosyaların bize ulaştı. Ekibimiz önce dosyaların üretime uygun olduğunu ve sözlerin şarkıyla eşleştiğini kontrol edecek.",
        `Dosyaların onaylandığı andan itibaren üç ön izlemeni ${settings.previewTargetHours} saat içinde hazırlamayı hedefliyoruz. Gecikme olursa sana haber vereceğiz.`,
      ],
      cta: { label: "Denememi takip et", href: "/panel/deneme" },
    },
  });
  await notifyAdmins({
    title: `Yeni deneme başvurusu: ${created.number}`,
    body: "Dosya kontrolü bekliyor. Kontrol onaylanınca ön izleme süresi başlar.",
    href: `/admin/denemeler/${created.number}`,
  });
  return created;
}

/** Müşteri, eksik bilgi istenen başvuruyu güncelleyip yeniden kontrole gönderir. */
export async function resubmitTrial(userId: string, input: { lyrics: string; notesForEditor?: string; message?: string }) {
  const trial = await db.trialApplication.findUnique({
    where: { userId },
    include: { files: { where: { status: { not: "DELETED" } } }, song: true },
  });
  if (!trial) throw new DomainError("Deneme başvurusu bulunamadı.", "NOT_FOUND");
  if (trial.status !== "NEEDS_INFO") throw new DomainError("Başvurun şu an düzenlenemez.", "TRIAL_STATE");

  const report = automatedTrialCheck({ lyrics: input.lyrics, files: trial.files, footageSource: trial.footageSource });
  if (!report.ok) throw new DomainError(`Başvurun henüz gönderilemedi:\n• ${report.problems.join("\n• ")}`, "TRIAL_CHECK");

  await db.$transaction(async (tx) => {
    await tx.song.update({ where: { id: trial.songId }, data: { lyrics: input.lyrics } });
    const { count } = await tx.trialApplication.updateMany({
      where: { id: trial.id, status: "NEEDS_INFO" },
      data: {
        status: "FILES_CHECK",
        notesForEditor: input.notesForEditor ?? trial.notesForEditor,
        checkReport: report as unknown as Prisma.InputJsonValue,
      },
    });
    if (!count) throw new DomainError("Başvurun şu an düzenlenemez.", "TRIAL_STATE");
    await event(tx, trial.id, "RESUBMITTED", input.message ? `Bilgiler güncellendi: ${input.message}` : "Bilgiler güncellendi, dosyalar yeniden kontrol ediliyor.", userId);
  });
  await notifyAdmins({
    title: `Deneme güncellendi: ${trial.number}`,
    body: "Müşteri istenen bilgileri gönderdi; dosya kontrolü bekliyor.",
    href: `/admin/denemeler/${trial.number}`,
  });
}

export async function decideTrialLater(userId: string) {
  await db.trialApplication.updateMany({ where: { userId, convertedOrderId: null }, data: { decideLaterAt: new Date() } });
}

// ───────────────────────────── Ekip: dosya kontrolü ─────────────────────────────

/** Dosyalar uygun: başvuru üretim kuyruğuna alınır ve ön izleme hedef süresi başlar. */
export async function verifyTrialFiles(adminId: string, trialId: string) {
  const trial = await db.trialApplication.findUnique({
    where: { id: trialId },
    include: { files: { where: { status: { not: "DELETED" } } }, song: { select: { lyrics: true } } },
  });
  if (!trial) throw new DomainError("Başvuru bulunamadı.", "NOT_FOUND");
  if (trial.status !== "FILES_CHECK" && trial.status !== "RECEIVED") throw new DomainError("Bu başvuru dosya kontrolü aşamasında değil.", "TRIAL_STATE");
  const report = automatedTrialCheck({ lyrics: trial.song.lyrics, files: trial.files, footageSource: trial.footageSource });
  if (!report.ok) throw new DomainError(`Otomatik kontrol geçmedi: ${report.problems.join(" ")} Müşteriden eksik bilgi isteyin.`, "TRIAL_CHECK");

  const settings = await readSystemSetting("system.trial");
  const now = new Date();
  const due = new Date(now.getTime() + settings.previewTargetHours * 60 * 60 * 1000);
  await db.$transaction(async (tx) => {
    const { count } = await tx.trialApplication.updateMany({
      where: { id: trialId, status: { in: ["FILES_CHECK", "RECEIVED"] } },
      data: {
        status: "QUEUED",
        filesVerifiedAt: now,
        filesVerifiedById: adminId,
        previewDueAt: due,
        needsInfoMessage: null,
        checkReport: report as unknown as Prisma.InputJsonValue,
      },
    });
    if (!count) throw new DomainError("Başvuru başka bir işlemle güncellendi.", "TRIAL_STATE");
    const existing = await tx.trialVideo.count({ where: { trialId } });
    if (existing < TRIAL_VIDEO_COUNT) {
      const approaches = proposeTrialApproaches({ hasMusicVideo: trial.files.some((f) => f.kind === "MUSIC_VIDEO") });
      await tx.trialVideo.createMany({
        data: approaches.slice(existing).map((a) => ({ trialId, sequence: a.sequence, style: a.style, approach: a.approach })),
        skipDuplicates: true,
      });
    }
    await tx.trialVideo.updateMany({ where: { trialId, status: "RECEIVED" }, data: { status: "QUEUED" } });
    await event(tx, trialId, "FILES_VERIFIED", `Dosyaların onaylandı. Üç ön izleme için hedef: ${formatDateTime(due)}.`, adminId);
    await audit({ actorId: adminId, action: "trial.verify_files", entityType: "TrialApplication", entityId: trialId, summary: trial.number }, tx);
  });
  await notifyUser({
    userId: trial.userId,
    type: "TRIAL_UPDATE",
    title: "Dosyaların onaylandı, üretim kuyruğundasın",
    body: `Üç ön izlemen için hedef zaman: ${formatDateTime(due)}.`,
    email: {
      subject: "Dosyaların onaylandı — ön izlemelerin hazırlanıyor",
      paragraphs: [
        "Dosyaların ve sözlerin kontrol edildi, başvurun üretim kuyruğuna alındı.",
        `Üç ön izlemen için hedefimiz ${formatDateTime(due)}. Hazır olduğunda e-posta ve panel bildirimiyle haber vereceğiz.`,
      ],
      cta: { label: "Denememi takip et", href: "/panel/deneme" },
    },
  });
}

/** Ekip, eksik/hatalı dosya için müşteriden ek bilgi ister; başvuru kuyruğa alınmaz. */
export async function requestTrialInfo(adminId: string, trialId: string, message: string) {
  const text = message.trim();
  if (text.length < 5) throw new DomainError("Müşteriye ne gerektiğini açıkça yazın.");
  const trial = await db.trialApplication.findUnique({ where: { id: trialId } });
  if (!trial) throw new DomainError("Başvuru bulunamadı.", "NOT_FOUND");
  const { count } = await db.trialApplication.updateMany({
    where: { id: trialId, status: { in: ["RECEIVED", "FILES_CHECK"] } },
    data: { status: "NEEDS_INFO", needsInfoMessage: text },
  });
  if (!count) throw new DomainError("Ek bilgi yalnızca dosya kontrolü aşamasında istenebilir.", "TRIAL_STATE");
  await event(db, trialId, "NEEDS_INFO", text, adminId);
  await audit({ actorId: adminId, action: "trial.request_info", entityType: "TrialApplication", entityId: trialId, summary: text.slice(0, 200) });
  await notifyUser({
    userId: trial.userId,
    type: "FILES_NEEDED",
    title: "Denemen için ek bilgi gerekiyor",
    body: text,
    email: {
      subject: "Ücretsiz denemen için bir eksik var",
      paragraphs: ["Dosyalarını kontrol ettik; üretime başlamadan önce şu bilgiye ihtiyacımız var:", text, "Panelindeki deneme sayfasından eksikleri tamamlayıp yeniden gönderebilirsin."],
      cta: { label: "Eksikleri tamamla", href: "/panel/deneme" },
    },
  });
}

export async function cancelTrial(adminId: string, trialId: string, reason: string) {
  const trial = await db.trialApplication.findUnique({ where: { id: trialId } });
  if (!trial) throw new DomainError("Başvuru bulunamadı.", "NOT_FOUND");
  if (trial.convertedOrderId) throw new DomainError("Satın almaya dönüşmüş deneme iptal edilemez.");
  await db.$transaction(async (tx) => {
    await tx.trialApplication.update({ where: { id: trialId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.slice(0, 300) } });
    await tx.trialVideo.updateMany({ where: { trialId }, data: { status: "CANCELLED" } });
    await event(tx, trialId, "CANCELLED", reason ? `Deneme iptal edildi: ${reason}` : "Deneme iptal edildi.", adminId);
    await audit({ actorId: adminId, action: "trial.cancel", entityType: "TrialApplication", entityId: trialId, summary: reason }, tx);
  });
  await notifyUser({ userId: trial.userId, type: "TRIAL_UPDATE", title: "Deneme başvurun kapatıldı", body: reason || "Ayrıntı için bizimle iletişime geçebilirsin." });
}

// ───────────────────────────── Ekip: video işleri ─────────────────────────────

async function loadVideo(videoId: string) {
  const video = await db.trialVideo.findUnique({ where: { id: videoId }, include: { trial: true, project: { select: { id: true } } } });
  if (!video) throw new DomainError("Deneme videosu bulunamadı.", "NOT_FOUND");
  if (!video.trial.filesVerifiedAt) throw new DomainError("Dosya kontrolü tamamlanmadan üretim başlatılamaz.", "TRIAL_STATE");
  if (video.trial.status === "CANCELLED") throw new DomainError("Bu deneme iptal edilmiş.", "TRIAL_STATE");
  return video;
}

export async function assignTrialEditor(adminId: string, videoId: string, editorId: string | null) {
  const video = await loadVideo(videoId);
  if (editorId) {
    const editor = await db.editor.findFirst({ where: { id: editorId, active: true } });
    if (!editor) throw new DomainError("Editör bulunamadı veya pasif.");
  }
  await db.trialVideo.update({ where: { id: videoId }, data: { editorId } });
  await event(db, video.trialId, "EDITOR", `Video ${video.sequence} için editör ${editorId ? "atandı" : "kaldırıldı"}.`, adminId, false);
}

export async function moveTrialVideo(adminId: string, videoId: string, to: TrialStageValue, note?: string) {
  const video = await loadVideo(videoId);
  if (to === "PREVIEW_READY") throw new DomainError("Ön izleme, kalite kontrol onayıyla hazır olur.");
  if (!canMoveTrialVideo(video.status, to)) {
    throw new DomainError(`${TRIAL_STAGE_LABEL[video.status]} → ${TRIAL_STAGE_LABEL[to]} geçişi yapılamaz.`);
  }
  const { count } = await db.trialVideo.updateMany({
    where: { id: videoId, status: video.status },
    data: { status: to, ...(to === "FAILED" ? { processingError: note ?? "Ekip tarafından hata olarak işaretlendi." } : {}) },
  });
  if (!count) throw new DomainError("Video başka bir işlemle güncellendi.");
  await event(db, video.trialId, "VIDEO_STATUS", `Video ${video.sequence}: ${TRIAL_STAGE_LABEL[to]}${note ? ` — ${note}` : ""}`, adminId, false);
  await syncTrialStatus(video.trialId);
}

/** Editörün dışa aktardığı temiz ana dosyayı videoya bağlar; ffmpeg varsa ön izlemeyi otomatik üretir. */
export async function attachTrialMaster(adminId: string, videoId: string, fileId: string) {
  const video = await loadVideo(videoId);
  if (video.project) throw new DomainError("Satın almaya dönüşmüş videonun ana dosyası değiştirilemez.");
  const file = await db.uploadedFile.findFirst({ where: { id: fileId, kind: "TRIAL_MASTER", status: "UPLOADED", trialId: null } });
  if (!file) throw new DomainError("Ana dosya bulunamadı veya başka bir videoya bağlı.");
  await db.$transaction(async (tx) => {
    await tx.uploadedFile.update({ where: { id: fileId }, data: { trialId: video.trialId } });
    await tx.trialVideo.update({
      where: { id: videoId },
      data: {
        masterFileId: fileId,
        status: ["QUEUED", "IN_PRODUCTION", "FAILED"].includes(video.status) ? "EDITOR_REVIEW" : video.status,
        processingError: null,
      },
    });
    if (video.masterFileId && video.masterFileId !== fileId) {
      await tx.uploadedFile.update({ where: { id: video.masterFileId }, data: { status: "DELETED", deletedAt: new Date() } });
    }
    await event(tx, video.trialId, "MASTER", `Video ${video.sequence}: ana dosya yüklendi, editör kontrolünde.`, adminId, false);
  });
  await syncTrialStatus(video.trialId);
  const caps = await ffmpegCapabilities();
  if (caps.available) await generateTrialPreview(adminId, videoId).catch(() => undefined);
}

/** Ön izleme kesitini editör ayrı dışa aktardıysa (filigranlı kısa kesit) videoya bağlar. */
export async function attachTrialPreview(adminId: string, videoId: string, previewFileId: string, posterFileId: string | null, watermarked: boolean) {
  const video = await loadVideo(videoId);
  const preview = await db.uploadedFile.findFirst({ where: { id: previewFileId, kind: "TRIAL_PREVIEW", status: "UPLOADED", trialId: null } });
  if (!preview) throw new DomainError("Ön izleme dosyası bulunamadı veya başka bir videoya bağlı.");
  if (posterFileId) {
    const poster = await db.uploadedFile.findFirst({ where: { id: posterFileId, kind: "TRIAL_POSTER", status: "UPLOADED", trialId: null } });
    if (!poster) throw new DomainError("Kapak görseli bulunamadı.");
  }
  await db.$transaction(async (tx) => {
    await tx.uploadedFile.updateMany({ where: { id: { in: [previewFileId, ...(posterFileId ? [posterFileId] : [])] } }, data: { trialId: video.trialId } });
    await tx.trialVideo.update({
      where: { id: videoId },
      data: {
        previewFileId,
        posterFileId: posterFileId ?? video.posterFileId,
        previewSource: "upload",
        watermarked,
        blurred: false,
        processingError: null,
        status: video.status === "PREVIEW_READY" ? "EDITOR_REVIEW" : video.status === "QUEUED" || video.status === "IN_PRODUCTION" ? "EDITOR_REVIEW" : video.status,
        qcApprovedAt: null,
      },
    });
    await event(tx, video.trialId, "PREVIEW", `Video ${video.sequence}: ön izleme kesiti yüklendi (kalite kontrol bekliyor).`, adminId, false);
  });
  await syncTrialStatus(video.trialId);
}

/**
 * Sunucuda ffmpeg ile ana dosyadan kısa ön izleme kesiti ve kapak karesi üretir.
 * Hata olursa video "Hata oluştu" durumuna geçer; ekip yeniden kuyruğa alabilir.
 */
export async function generateTrialPreview(adminId: string | null, videoId: string) {
  const video = await db.trialVideo.findUnique({ where: { id: videoId }, include: { trial: true, masterFile: true } });
  if (!video) throw new DomainError("Deneme videosu bulunamadı.", "NOT_FOUND");
  if (!video.masterFile || video.masterFile.status !== "UPLOADED") throw new DomainError("Önce temiz ana dosyayı yükleyin.");
  const caps = await ffmpegCapabilities();
  if (!caps.available) {
    throw new DomainError(`Sunucuda ffmpeg yok (${caps.error ?? "yapılandırılmadı"}). Ön izlemeyi editörün dışa aktardığı dosyayla yükleyin.`, "FFMPEG");
  }
  const settings = await readSystemSetting("system.trial");
  await db.trialVideo.update({ where: { id: videoId }, data: { attempts: { increment: 1 }, lastAttemptAt: new Date() } });

  const dir = await mkdtemp(path.join(os.tmpdir(), "addlyrics-preview-"));
  try {
    const source = path.join(dir, `master${path.extname(video.masterFile.storageKey) || ".mp4"}`);
    const previewOut = path.join(dir, "preview.mp4");
    const posterOut = path.join(dir, "poster.png");
    await storage().getToFile(video.masterFile.storageKey, source);
    const plan = buildPreviewPlan({
      source,
      output: previewOut,
      startSeconds: video.previewStartSec || settings.previewStartSeconds,
      durationSeconds: settings.previewSeconds,
      watermarkPath: watermarkFile(),
      watermark: settings.watermark,
      blur: settings.blur,
      filters: caps.filters,
    });
    await runFfmpeg(plan.args);
    await runFfmpeg(buildPosterArgs(source, posterOut, (video.previewStartSec || settings.previewStartSeconds) + 1)).catch(() => undefined);

    const ownerId = video.masterFile.ownerId;
    const stored = async (kind: "TRIAL_PREVIEW" | "TRIAL_POSTER", local: string, name: string, mime: string, ext: string) => {
      const record = await db.uploadedFile.create({
        data: { ownerId, trialId: video.trialId, kind, storageKey: `pending/${crypto.randomUUID()}`, originalName: name, mimeType: mime, sizeBytes: BigInt(0) },
      });
      const key = buildStorageKey("trials", video.trial.userId, record.id, ext);
      const size = await storage().putFile(key, local, mime);
      return db.uploadedFile.update({
        where: { id: record.id },
        data: { storageKey: key, sizeBytes: BigInt(size), status: "UPLOADED", uploadedAt: new Date() },
      });
    };
    const preview = await stored("TRIAL_PREVIEW", previewOut, `onizleme-${video.sequence}.mp4`, "video/mp4", ".mp4");
    const poster = await stored("TRIAL_POSTER", posterOut, `kapak-${video.sequence}.png`, "image/png", ".png").catch(() => null);

    await db.trialVideo.update({
      where: { id: videoId },
      data: {
        previewFileId: preview.id,
        posterFileId: poster?.id ?? video.posterFileId,
        previewSource: "ffmpeg",
        previewSeconds: settings.previewSeconds,
        watermarked: plan.watermarked,
        blurred: plan.blurred,
        processingError: null,
        qcApprovedAt: null,
        status: video.status === "FAILED" || video.status === "PREVIEW_READY" ? "EDITOR_REVIEW" : video.status,
      },
    });
    // Önceki ön izleme dosyaları kaldırılır
    for (const old of [video.previewFileId, poster ? video.posterFileId : null]) {
      if (old && old !== preview.id) await db.uploadedFile.update({ where: { id: old }, data: { status: "DELETED", deletedAt: new Date() } }).catch(() => undefined);
    }
    await event(db, video.trialId, "PREVIEW", `Video ${video.sequence}: ön izleme kesiti üretildi${plan.watermarked ? " (filigranlı)" : " — filigran eklenemedi, kalite kontrolde dikkat edin"}.`, adminId, false);
  } catch (err) {
    const message = (err as Error).message.slice(0, 1000);
    await db.trialVideo.update({ where: { id: videoId }, data: { status: "FAILED", processingError: message } });
    await event(db, video.trialId, "PREVIEW_FAILED", `Video ${video.sequence}: ön izleme üretilemedi.`, adminId, false);
    await notifyAdmins({ title: `Ön izleme hatası: ${video.trial.number}`, body: message.slice(0, 300), href: `/admin/denemeler/${video.trial.number}` });
    await syncTrialStatus(video.trialId);
    throw new DomainError(`Ön izleme üretilemedi: ${message}`, "PREVIEW_FAILED");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
  await syncTrialStatus(video.trialId);
}

/** Kalite kontrol onayı: ön izleme müşteriye açılır. Üç video da hazırsa müşteri bilgilendirilir. */
export async function approveTrialPreview(adminId: string, videoId: string) {
  const video = await loadVideo(videoId);
  if (!video.masterFileId) throw new DomainError("Temiz ana dosya yüklenmeden ön izleme onaylanamaz (satın almada bu dosya teslim edilir).");
  if (!video.previewFileId) throw new DomainError("Önce ön izleme kesitini üretin veya yükleyin.");
  const now = new Date();
  const { count } = await db.trialVideo.updateMany({
    where: { id: videoId, status: "EDITOR_REVIEW" },
    data: { status: "PREVIEW_READY", previewReadyAt: now, qcApprovedAt: now, qcById: adminId },
  });
  if (!count) throw new DomainError("Yalnızca editör kontrolündeki videolar onaylanabilir.");
  await event(db, video.trialId, "PREVIEW_READY", `Video ${video.sequence} ön izlemesi hazır.`, adminId);
  await audit({ actorId: adminId, action: "trial.approve_preview", entityType: "TrialVideo", entityId: videoId, summary: `${video.trial.number} #${video.sequence}` });
  await syncTrialStatus(video.trialId);
}

/** Hatalı videoyu yeniden kuyruğa alır (ana dosya varsa ön izleme yeniden üretilir). */
export async function retryTrialVideo(adminId: string, videoId: string) {
  const video = await loadVideo(videoId);
  if (video.status !== "FAILED") throw new DomainError("Yalnızca hatalı videolar yeniden kuyruğa alınabilir.");
  await db.trialVideo.update({
    where: { id: videoId },
    data: { status: video.masterFileId ? "EDITOR_REVIEW" : "QUEUED", processingError: null },
  });
  await event(db, video.trialId, "RETRY", `Video ${video.sequence} yeniden kuyruğa alındı.`, adminId, false);
  await syncTrialStatus(video.trialId);
  const caps = await ffmpegCapabilities();
  if (video.masterFileId && caps.available) await generateTrialPreview(adminId, videoId);
}

/**
 * Başvuru durumunu videolardan yeniden hesaplar. Üç ön izleme hazır olduğu ilk anda müşteriye
 * e-posta ve panel bildirimi gönderilir (bir kez).
 */
export async function syncTrialStatus(trialId: string) {
  const trial = await db.trialApplication.findUnique({ where: { id: trialId }, include: { videos: { select: { status: true } } } });
  if (!trial || !trial.filesVerifiedAt) return;
  if (trial.status === "CANCELLED" || trial.status === "COMPLETED") return;
  const next = aggregateTrialStage(trial.videos.map((v) => v.status));
  if (next === trial.status) return;
  const becameReady = next === "PREVIEW_READY" && !trial.previewsReadyAt;
  const { count } = await db.trialApplication.updateMany({
    where: { id: trialId, status: trial.status },
    data: { status: next, ...(becameReady ? { previewsReadyAt: new Date() } : {}) },
  });
  if (!count || !becameReady) return;
  await event(db, trialId, "PREVIEWS_READY", "Üç ön izlemen hazır. Videolarını panelinde inceleyebilirsin.", null);
  await notifyUser({
    userId: trial.userId,
    type: "PREVIEWS_READY",
    title: "Üç ön izlemen hazır",
    body: "Sana özel hazırlanan üç lyric videonun ön izlemelerini panelinde karşılaştırabilirsin.",
    email: {
      subject: "Ön izlemelerin hazır — AddLyrics ücretsiz deneme",
      paragraphs: [
        "Şarkın için hazırladığımız üç farklı lyric videonun ön izlemeleri panelinde seni bekliyor.",
        "Ön izlemeler kısa ve filigranlıdır. Bir paket satın aldığında bu üç videonun tam ve temiz sürümleri yeniden üretilmeden teslim edilir.",
      ],
      cta: { label: "Videolarımı İncele", href: "/panel/deneme" },
    },
  });
}

// ───────────────────────────── Bakım: gecikme ve saklama ─────────────────────────────

/** Hedef süreyi aşan denemeler için ekibe uyarı ve müşteriye gecikme bildirimi (bir kez). */
export async function checkTrialDelays(now = new Date()) {
  const late = await db.trialApplication.findMany({
    where: { previewDueAt: { lt: now }, delayNotifiedAt: null, status: { in: ["QUEUED", "IN_PRODUCTION", "FAILED"] } },
    select: { id: true, number: true, userId: true, previewDueAt: true },
  });
  for (const t of late) {
    const { count } = await db.trialApplication.updateMany({ where: { id: t.id, delayNotifiedAt: null }, data: { delayNotifiedAt: now } });
    if (!count) continue;
    await event(db, t.id, "DELAYED", "Ön izlemelerin planlanandan uzun sürüyor; ekibimiz öncelikle ilgileniyor.", null);
    await notifyAdmins({
      title: `Deneme gecikti: ${t.number}`,
      body: `Ön izleme hedefi ${formatDateTime(t.previewDueAt!)} idi. Üretim kuyruğunu kontrol edin.`,
      href: `/admin/denemeler/${t.number}`,
    });
    await notifyUser({
      userId: t.userId,
      type: "TRIAL_UPDATE",
      title: "Ön izlemelerin biraz gecikecek",
      body: "Ön izlemelerin hedeflediğimiz sürede hazır olmadı. Ekibimiz öncelikle ilgileniyor; hazır olduğunda haber vereceğiz.",
      email: {
        subject: "Ön izlemelerin biraz gecikecek",
        paragraphs: ["Ön izlemelerin hedeflediğimiz sürede hazır olmadı, bunun için özür dileriz.", "Ekibimiz başvurunla öncelikli olarak ilgileniyor; hazır olduğunda e-postayla haber vereceğiz."],
        cta: { label: "Denememi takip et", href: "/panel/deneme" },
      },
    });
  }
  return late.length;
}

/** Satın alınmayan denemelerin dosyalarını saklama süresi sonunda siler (KVKK: amaç ortadan kalktığında imha). */
export async function purgeExpiredTrials(now = new Date()) {
  const settings = await readSystemSetting("system.trial");
  const cutoff = new Date(now.getTime() - settings.retentionDays * 24 * 60 * 60 * 1000);
  const expired = await db.trialApplication.findMany({
    where: { convertedOrderId: null, purgedAt: null, OR: [{ previewsReadyAt: { lt: cutoff } }, { previewsReadyAt: null, createdAt: { lt: cutoff } }] },
    include: { files: { where: { status: { not: "DELETED" }, orderId: null } } },
  });
  for (const t of expired) {
    for (const f of t.files) {
      await storage().delete(f.storageKey).catch(() => undefined);
    }
    await db.$transaction(async (tx) => {
      await tx.uploadedFile.updateMany({ where: { id: { in: t.files.map((f) => f.id) } }, data: { status: "DELETED", deletedAt: now } });
      await tx.trialApplication.update({ where: { id: t.id }, data: { purgedAt: now } });
      await event(tx, t.id, "PURGED", `Saklama süresi (${settings.retentionDays} gün) dolduğu için deneme dosyaları silindi.`, null);
    });
  }
  return expired.length;
}
