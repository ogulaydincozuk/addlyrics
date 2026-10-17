"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import type { ActionState } from "@/lib/action-state";
import { safeNextPath } from "@/server/auth/guards";
import { clientIpFromHeaders, getSessionUser } from "@/server/auth/session";
import { isDomainError } from "@/server/domain/errors";
import { rateLimitByIp } from "@/server/rate-limit";
import { confirmPhoneVerification, sendEmailVerification, startPhoneVerification } from "@/server/verification/service";
import { smsProvider } from "@/server/env";

async function guarded(fn: (userId: string) => Promise<ActionState>): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Oturumun sona ermiş. Lütfen tekrar giriş yap." };
  try {
    return await fn(user.id);
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    console.error("[verification]", err);
    return { ok: false, message: "İşlem tamamlanamadı. Lütfen tekrar dene." };
  }
}

export async function resendEmailVerification(next: string, _prev: ActionState): Promise<ActionState> {
  return guarded(async (userId) => {
    const limit = await rateLimitByIp("verifyEmail", userId);
    if (!limit.ok) return { ok: false, message: "Çok fazla istek. Lütfen biraz sonra tekrar dene." };
    const result = await sendEmailVerification(userId, safeNextPath(next, "/panel"));
    return { ok: true, message: result.alreadyVerified ? "E-posta adresin zaten doğrulanmış." : "Doğrulama bağlantısı e-posta adresine gönderildi." };
  });
}

export async function sendPhoneCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return guarded(async (userId) => {
    const limit = await rateLimitByIp("otpSend", userId);
    if (!limit.ok) return { ok: false, message: "Çok fazla kod istendi. Lütfen biraz sonra tekrar dene." };
    const ip = clientIpFromHeaders(await headers());
    const result = await startPhoneVerification(userId, String(formData.get("phone") ?? ""), ip);
    refresh();
    return {
      ok: true,
      message:
        smsProvider() === "console"
          ? "Geliştirme ortamı: SMS gönderilmedi, kod sunucu günlüğüne yazıldı."
          : `Doğrulama kodu ${result.phone} numarasına gönderildi. Kod 10 dakika geçerli.`,
    };
  });
}

export async function confirmPhoneCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return guarded(async (userId) => {
    const limit = await rateLimitByIp("otpVerify", userId);
    if (!limit.ok) return { ok: false, message: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene." };
    await confirmPhoneVerification(userId, String(formData.get("code") ?? ""));
    refresh();
    return { ok: true, message: "Telefon numaran doğrulandı." };
  });
}
