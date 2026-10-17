"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { TRIAL_STAGES } from "@/lib/trial";
import { requireAdmin } from "@/server/auth/guards";
import { isDomainError } from "@/server/domain/errors";
import {
  approveTrialPreview,
  assignTrialEditor,
  attachTrialMaster,
  attachTrialPreview,
  cancelTrial,
  generateTrialPreview,
  moveTrialVideo,
  requestTrialInfo,
  retryTrialVideo,
  verifyTrialFiles,
} from "@/server/domain/trials";

/** Yetki kontrolü sunucuda: her eylem yöneticiyi yeniden doğrular. */
async function run(fn: (adminId: string) => Promise<string | void>): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const message = await fn(admin.id);
    refresh();
    return { ok: true, message: message || "Kaydedildi." };
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    console.error("[admin:trials]", err);
    return { ok: false, message: "İşlem tamamlanamadı." };
  }
}

export async function verifyFilesAction(trialId: string, _prev: ActionState) {
  return run(async (adminId) => {
    await verifyTrialFiles(adminId, trialId);
    return "Dosyalar onaylandı; başvuru üretim kuyruğunda ve ön izleme süresi başladı.";
  });
}

export async function requestInfoAction(trialId: string, _prev: ActionState, formData: FormData) {
  return run(async (adminId) => {
    await requestTrialInfo(adminId, trialId, String(formData.get("message") ?? ""));
    return "Müşteriden ek bilgi istendi.";
  });
}

export async function cancelTrialAction(trialId: string, _prev: ActionState, formData: FormData) {
  return run(async (adminId) => {
    await cancelTrial(adminId, trialId, String(formData.get("reason") ?? "").trim());
    return "Deneme iptal edildi.";
  });
}

export async function assignVideoEditorAction(videoId: string, _prev: ActionState, formData: FormData) {
  return run(async (adminId) => {
    const editorId = String(formData.get("editorId") ?? "") || null;
    await assignTrialEditor(adminId, videoId, editorId);
    return editorId ? "Editör atandı." : "Editör kaldırıldı.";
  });
}

export async function moveVideoAction(videoId: string, _prev: ActionState, formData: FormData) {
  const to = z.enum(TRIAL_STAGES).safeParse(formData.get("to"));
  if (!to.success) return { ok: false, message: "Geçerli bir durum seç." };
  return run(async (adminId) => {
    await moveTrialVideo(adminId, videoId, to.data, String(formData.get("note") ?? "").trim() || undefined);
    return "Durum güncellendi.";
  });
}

export async function attachMasterAction(videoId: string, fileId: string) {
  return run(async (adminId) => {
    await attachTrialMaster(adminId, videoId, fileId);
    return "Ana dosya bağlandı.";
  });
}

export async function attachPreviewAction(videoId: string, previewFileId: string, posterFileId: string | null, watermarked: boolean) {
  return run(async (adminId) => {
    await attachTrialPreview(adminId, videoId, previewFileId, posterFileId, watermarked);
    return "Ön izleme bağlandı; kalite kontrol bekliyor.";
  });
}

export async function generatePreviewAction(videoId: string, _prev: ActionState) {
  return run(async (adminId) => {
    await generateTrialPreview(adminId, videoId);
    return "Ön izleme üretildi; kalite kontrol bekliyor.";
  });
}

export async function approvePreviewAction(videoId: string, _prev: ActionState) {
  return run(async (adminId) => {
    await approveTrialPreview(adminId, videoId);
    return "Ön izleme onaylandı ve müşteriye açıldı.";
  });
}

export async function retryVideoAction(videoId: string, _prev: ActionState) {
  return run(async (adminId) => {
    await retryTrialVideo(adminId, videoId);
    return "Video yeniden kuyruğa alındı.";
  });
}
