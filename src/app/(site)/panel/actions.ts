"use server";

import { normalizePhone } from "@/lib/phone";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { flattenErrors, orderMessageSchema, passwordSchema } from "@/lib/validation";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroyAllSessions, getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { isDomainError } from "@/server/domain/errors";
import { refreshFileRequirements, sendCustomerMessage } from "@/server/domain/orders";
import { CUSTOMER_EDITABLE_STATUSES } from "@/lib/order-status";
import { rateLimitByIp } from "@/server/rate-limit";

async function currentUser() {
  const user = await getSessionUser();
  if (!user) redirect("/giris");
  return user;
}

export async function markNotificationsRead() {
  const user = await currentUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  refresh();
}

/** Siparişle ilgili ekibe mesaj (ekibin üretim öncesi sorularına yanıt). */
export async function sendOrderMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await currentUser();
  const parsed = orderMessageSchema.safeParse({ orderNumber: formData.get("orderNumber"), message: formData.get("message") });
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  const limit = await rateLimitByIp("orderMessage", user.id);
  if (!limit.ok) return { ok: false, message: "Çok fazla mesaj gönderildi. Lütfen biraz sonra tekrar dene." };
  try {
    await sendCustomerMessage(user.id, parsed.data.orderNumber, parsed.data.message);
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    throw err;
  }
  refresh();
  return { ok: true, message: "Mesajın ekibimize iletildi." };
}

const lyricsSchema = z.object({ orderNumber: z.string().min(1).max(40), lyrics: z.string().trim().max(20000) });

/** Sözler eksikse müşteri sipariş üretime girmeden önce ekleyebilir/güncelleyebilir. */
export async function updateLyrics(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await currentUser();
  const parsed = lyricsSchema.safeParse({ orderNumber: formData.get("orderNumber"), lyrics: formData.get("lyrics") });
  if (!parsed.success) return { ok: false, message: "Sözler kaydedilemedi." };
  const order = await db.order.findFirst({ where: { number: parsed.data.orderNumber, userId: user.id } });
  if (!order) return { ok: false, message: "Sipariş bulunamadı." };
  if (!CUSTOMER_EDITABLE_STATUSES.includes(order.status)) {
    return { ok: false, message: "Üretimi başlamış siparişte sözler değiştirilemez. Ekibimizle iletişime geç." };
  }
  await db.song.update({ where: { id: order.songId }, data: { lyrics: parsed.data.lyrics || null } });
  await db.orderEvent.create({
    data: { orderId: order.id, actorId: user.id, type: "LYRICS", message: "Şarkı sözleri güncellendi.", visibleToCustomer: true },
  });
  await refreshFileRequirements(order.id);
  refresh();
  return { ok: true, message: "Sözler kaydedildi." };
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Adını yaz.").max(100),
  artistName: z.string().trim().max(100).optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^(\+?[0-9\s()-]{10,20})?$/, "Geçerli bir telefon numarası yaz.")
    .optional(),
});

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await currentUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    artistName: formData.get("artistName") ?? undefined,
    phone: formData.get("phone") ?? undefined,
  });
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, phoneVerifiedAt: true } });
  let phone = record.phone;
  // Doğrulanmış telefon buradan değiştirilemez (telefon başına hesap sınırı); doğrulanmamışsa normalize edilir
  if (!record.phoneVerifiedAt && parsed.data.phone) {
    const normalized = normalizePhone(parsed.data.phone);
    if (!normalized.ok) return { ok: false, errors: { phone: normalized.error } };
    phone = normalized.e164;
  }
  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, artistName: parsed.data.artistName || null, phone },
  });
  refresh();
  return { ok: true, message: "Bilgilerin güncellendi." };
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await currentUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = passwordSchema.safeParse(formData.get("newPassword"));
  if (!next.success) return { ok: false, errors: { newPassword: next.error.issues[0]!.message } };
  const limit = await rateLimitByIp("login", user.email);
  if (!limit.ok) return { ok: false, message: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene." };
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(record.passwordHash, current))) return { ok: false, errors: { currentPassword: "Mevcut şifre hatalı." } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next.data) } });
  // Diğer cihazlardaki oturumlar kapatılır, bu cihaz için yeni oturum açılır
  await destroyAllSessions(user.id);
  await createSession(user.id);
  return { ok: true, message: "Şifren güncellendi. Diğer cihazlardaki oturumların kapatıldı." };
}
