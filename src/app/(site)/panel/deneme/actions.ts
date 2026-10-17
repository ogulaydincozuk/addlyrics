"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { flattenErrors, trialResubmitSchema } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { isDomainError } from "@/server/domain/errors";
import { createTrialPurchaseOrder } from "@/server/domain/orders";
import { decideTrialLater, resubmitTrial } from "@/server/domain/trials";
import { rateLimitByIp } from "@/server/rate-limit";

export async function resubmitTrialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Oturumun sona ermiş. Lütfen tekrar giriş yap." };
  const parsed = trialResubmitSchema.safeParse({
    lyrics: formData.get("lyrics"),
    notesForEditor: formData.get("notesForEditor") ?? undefined,
    message: formData.get("message") ?? undefined,
  });
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  try {
    await resubmitTrial(user.id, parsed.data);
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    console.error("[trial:resubmit]", err);
    return { ok: false, message: "Gönderilemedi. Lütfen tekrar dene." };
  }
  refresh();
  return { ok: true, message: "Bilgilerin gönderildi; dosyaların yeniden kontrol ediliyor." };
}

export async function decideLaterAction() {
  const user = await getSessionUser();
  if (!user) return;
  await decideTrialLater(user.id);
  refresh();
}

export type TrialPurchaseResult = { ok: false; error: string };

/** Denemeden paket satın alma: sipariş oluşturulur ve ödeme sayfasına yönlendirilir. */
export async function startTrialPurchase(packageSlug: string): Promise<TrialPurchaseResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Oturumun sona ermiş. Lütfen tekrar giriş yap." };
  const limit = await rateLimitByIp("orderCreate", user.id);
  if (!limit.ok) return { ok: false, error: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene." };
  let number: string;
  try {
    number = (await createTrialPurchaseOrder(user.id, packageSlug)).number;
  } catch (err) {
    if (isDomainError(err)) return { ok: false, error: err.message };
    console.error("[trial:purchase]", err);
    return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar dene." };
  }
  redirect(`/siparis/${number}/odeme`);
}
