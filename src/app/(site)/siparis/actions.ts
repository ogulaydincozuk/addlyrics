"use server";

import { redirect } from "next/navigation";
import { flattenErrors, orderInputSchema } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { isDomainError } from "@/server/domain/errors";
import { createEntitlementOrder, createPurchaseOrder } from "@/server/domain/orders";
import { applyReferralCodeToOrder, previewReferralCode } from "@/server/domain/referrals";
import { formatMoney } from "@/lib/money";
import { rateLimitByIp } from "@/server/rate-limit";

export type OrderSubmitResult = { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ReferralPreviewResult =
  | { ok: true; code: string; message: string; discountLabel: string; totalLabel: string; listLabel: string }
  | { ok: false; message: string };

/** Sipariş özetindeki kod alanı: kodu doğrular ve indirimi gösterir (siparişe henüz uygulanmaz). */
export async function checkReferralCodeAction(packageSlug: string, codeInput: string): Promise<ReferralPreviewResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Oturumun sona ermiş. Lütfen tekrar giriş yap." };
  const limit = await rateLimitByIp("referralApply", user.id);
  if (!limit.ok) return { ok: false, message: "Çok fazla kod denemesi yapıldı. Lütfen biraz sonra tekrar dene." };
  try {
    const p = await previewReferralCode(user.id, packageSlug, String(codeInput ?? ""));
    return {
      ok: true,
      code: p.code,
      message: `${p.code} kodu geçerli: ${formatMoney(p.discountKurus, p.currency)} indirim.`,
      discountLabel: formatMoney(p.discountKurus, p.currency),
      totalLabel: formatMoney(p.priceKurus, p.currency),
      listLabel: formatMoney(p.listPriceKurus, p.currency),
    };
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    console.error("[referral:preview]", err);
    return { ok: false, message: "Kod kontrol edilemedi. Lütfen tekrar dene." };
  }
}

function referralCodeFrom(raw: unknown): string {
  if (!raw || typeof raw !== "object" || !("referralCode" in raw)) return "";
  const value = (raw as { referralCode?: unknown }).referralCode;
  return typeof value === "string" ? value.trim() : "";
}

async function prepare(raw: unknown): Promise<
  | { ok: true; userId: string; input: ReturnType<typeof orderInputSchema.parse> }
  | OrderSubmitResult
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Oturumun sona ermiş. Lütfen tekrar giriş yap." };
  const limit = await rateLimitByIp("orderCreate", user.id);
  if (!limit.ok) return { ok: false, error: "Çok fazla sipariş denemesi yapıldı. Lütfen biraz sonra tekrar dene." };
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Lütfen işaretli alanları kontrol et.", fieldErrors: flattenErrors(parsed.error) };
  }
  return { ok: true, userId: user.id, input: parsed.data };
}

/** Paket satın alma siparişi → ödeme sayfası. */
export async function submitPurchaseOrder(packageSlug: string, raw: unknown): Promise<OrderSubmitResult> {
  const ready = await prepare(raw);
  if (!ready.ok) return ready;
  // Referans kodu sipariş oluşturulmadan önce doğrulanır: geçersizse sipariş açılmaz, müşteri özet adımında düzeltir
  const referralCode = referralCodeFrom(raw);
  if (referralCode) {
    const limit = await rateLimitByIp("referralApply", ready.userId);
    if (!limit.ok) return { ok: false, error: "Çok fazla kod denemesi yapıldı. Kodu ödeme sayfasında tekrar deneyebilirsin.", fieldErrors: { referralCode: "Çok fazla deneme" } };
    try {
      await previewReferralCode(ready.userId, packageSlug, referralCode);
    } catch (err) {
      if (isDomainError(err)) return { ok: false, error: `Referans kodu: ${err.message}`, fieldErrors: { referralCode: err.message } };
      throw err;
    }
  }
  let number: string;
  try {
    const order = await createPurchaseOrder(ready.userId, packageSlug, ready.input);
    number = order.number;
  } catch (err) {
    if (isDomainError(err)) return { ok: false, error: err.message };
    console.error("[order:purchase]", err);
    return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar dene." };
  }
  if (referralCode) {
    try {
      await applyReferralCodeToOrder(ready.userId, number, referralCode);
    } catch (err) {
      // Kod doğrulama ile uygulama arasında geçersiz olduysa sipariş yine açılır; müşteri ödeme sayfasında kodu yeniden dener
      console.error("[order:purchase:referral]", number, err);
    }
  }
  redirect(`/siparis/${number}/odeme`);
}

/** Mevcut paket hakkından yeni şarkı siparişi (ödeme yok). */
export async function submitEntitlementOrder(entitlementId: string, raw: unknown): Promise<OrderSubmitResult> {
  const ready = await prepare(raw);
  if (!ready.ok) return ready;
  let number: string;
  try {
    const order = await createEntitlementOrder(ready.userId, entitlementId, ready.input);
    number = order.number;
  } catch (err) {
    if (isDomainError(err)) return { ok: false, error: err.message };
    console.error("[order:entitlement]", err);
    return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar dene." };
  }
  redirect(`/panel/siparislerim/${number}?olusturuldu=1`);
}
