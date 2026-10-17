"use server";

import { redirect } from "next/navigation";
import { flattenErrors, orderInputSchema } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { isDomainError } from "@/server/domain/errors";
import { createEntitlementOrder, createPurchaseOrder } from "@/server/domain/orders";
import { rateLimitByIp } from "@/server/rate-limit";

export type OrderSubmitResult = { ok: false; error: string; fieldErrors?: Record<string, string> };

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
  let number: string;
  try {
    const order = await createPurchaseOrder(ready.userId, packageSlug, ready.input);
    number = order.number;
  } catch (err) {
    if (isDomainError(err)) return { ok: false, error: err.message };
    console.error("[order:purchase]", err);
    return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar dene." };
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
