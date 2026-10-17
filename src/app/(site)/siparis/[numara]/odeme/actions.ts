"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formValues, type ActionState } from "@/lib/action-state";
import { billingSchema, flattenErrors } from "@/lib/validation";
import { clientIpFromHeaders, getSessionUser } from "@/server/auth/session";
import { isDomainError } from "@/server/domain/errors";
import { applyReferralCodeToOrder, removeReferralCodeFromOrder } from "@/server/domain/referrals";
import { startPayment } from "@/server/payments/service";
import { rateLimitByIp } from "@/server/rate-limit";
import { refresh } from "next/cache";

/** İndirim/referans kodu: doğrulama ve indirim hesabı sunucuda yapılır. */
export async function applyCodeAction(orderNumber: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  // Hata durumunda yazılan kod alanda kalsın diye geri döndürülür
  const values = formValues(formData, ["code"]);
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Oturumun sona ermiş. Lütfen tekrar giriş yap.", values };
  const limit = await rateLimitByIp("referralApply", user.id);
  if (!limit.ok) return { ok: false, message: "Çok fazla kod denemesi yapıldı. Lütfen biraz sonra tekrar dene.", values };
  try {
    const result = await applyReferralCodeToOrder(user.id, orderNumber, String(formData.get("code") ?? ""));
    refresh();
    return { ok: true, message: `${result.code} kodu uygulandı.` };
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message, values };
    console.error("[referral:apply]", err);
    return { ok: false, message: "Kod uygulanamadı. Lütfen tekrar dene.", values };
  }
}

export async function removeCodeAction(orderNumber: string) {
  const user = await getSessionUser();
  if (!user) return;
  await removeReferralCodeFromOrder(user.id, orderNumber);
  refresh();
}

export async function startPaymentAction(orderNumber: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  // distanceSales: işaretliyse "on" — hata sonrası onay kutusu da korunur (doğrulama aşağıda formData'dan yapılır)
  const values = formValues(formData, ["billingName", "billingPhone", "billingCity", "billingAddress", "billingIdentityNumber", "distanceSales"]);
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Oturumun sona ermiş. Lütfen tekrar giriş yap.", values };

  const parsed = billingSchema.safeParse({ ...values, distanceSales: formData.get("distanceSales") ?? undefined });
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };

  const limit = await rateLimitByIp("paymentStart", user.id);
  if (!limit.ok) return { ok: false, message: "Çok fazla ödeme denemesi yapıldı. Lütfen biraz sonra tekrar dene.", values };

  const ip = clientIpFromHeaders(await headers()) ?? "127.0.0.1";
  let checkoutUrl: string;
  try {
    const { distanceSales: _consent, ...billing } = parsed.data;
    const result = await startPayment(orderNumber, user.id, billing, ip);
    checkoutUrl = result.checkoutUrl;
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message, values };
    console.error("[payment:start]", err);
    return { ok: false, message: "Ödeme başlatılamadı. Lütfen tekrar dene.", values };
  }
  redirect(checkoutUrl);
}
