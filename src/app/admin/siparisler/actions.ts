"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseDateInput } from "@/lib/dates";
import { ORDER_STATUSES, VIDEO_FORMATS } from "@/lib/enums";
import { requireAdmin } from "@/server/auth/guards";
import { addDeliverable, releaseDeliverable, updateProjectPlan } from "@/server/domain/deliveries";
import { isDomainError } from "@/server/domain/errors";
import { addInternalNote, assignEditor, changeOrderStatus, markMessagesHandled, sendCustomerNote, setDueDate, unassignEditor } from "@/server/domain/orders";
import { markPaymentRefunded } from "@/server/payments/service";

/** Ortak sarmalayıcı: yetki kontrolü, iş kuralı hatalarının kullanıcıya gösterilmesi ve sayfa yenileme. */
async function run(fn: (adminId: string) => Promise<string | void>): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const message = await fn(admin.id);
    refresh();
    return { ok: true, message: message || "Kaydedildi." };
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    console.error("[admin:orders]", err);
    return { ok: false, message: "İşlem tamamlanamadı." };
  }
}

export async function changeStatusAction(orderId: string, _prev: ActionState, formData: FormData) {
  const to = z.enum(ORDER_STATUSES).safeParse(formData.get("to"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000) || null;
  if (!to.success) return { ok: false, message: "Geçerli bir durum seç." };
  return run(async (adminId) => {
    await changeOrderStatus(orderId, to.data, adminId, note);
    return "Durum güncellendi, müşteri bilgilendirildi.";
  });
}

export async function assignEditorAction(orderId: string, _prev: ActionState, formData: FormData) {
  const editorId = String(formData.get("editorId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  if (!editorId) return { ok: false, message: "Bir editör seç." };
  return run(async (adminId) => {
    await assignEditor(orderId, editorId, adminId, note);
    return "Editör atandı.";
  });
}

export async function unassignEditorAction(orderId: string, _prev: ActionState, _formData: FormData) {
  return run(async (adminId) => {
    await unassignEditor(orderId, adminId);
    return "Atama kaldırıldı.";
  });
}

export async function setDueDateAction(orderId: string, _prev: ActionState, formData: FormData) {
  const raw = String(formData.get("dueDate") ?? "");
  const date = raw ? parseDateInput(raw) : null;
  if (raw && !date) return { ok: false, message: "Geçerli bir tarih gir." };
  return run(async (adminId) => {
    await setDueDate(orderId, date, adminId);
    return date ? "Teslim tarihi kaydedildi." : "Teslim tarihi kaldırıldı.";
  });
}

export async function customerNoteAction(orderId: string, _prev: ActionState, formData: FormData) {
  const message = String(formData.get("message") ?? "").slice(0, 3000);
  return run(async (adminId) => {
    await sendCustomerNote(orderId, message, adminId);
    return "Not müşteriye gönderildi.";
  });
}

export async function markMessagesHandledAction(orderId: string, _prev: ActionState, _formData: FormData) {
  return run(async (adminId) => {
    await markMessagesHandled(orderId, adminId);
    return "Yanıt gerekmiyor olarak işaretlendi.";
  });
}

export async function internalNoteAction(orderId: string, _prev: ActionState, formData: FormData) {
  const message = String(formData.get("message") ?? "").slice(0, 3000);
  return run(async (adminId) => {
    await addInternalNote(orderId, message, adminId);
    return "İç not eklendi.";
  });
}

/** Teslim videosu yüklendikten sonra istemci tarafından çağrılır. */
export async function addDeliverableAction(projectId: string, fileId: string, note: string): Promise<ActionState> {
  return run(async (adminId) => {
    await addDeliverable(projectId, fileId, adminId, note.slice(0, 1000));
    return "Video yüklendi. Müşteriye açmak için \"Müşteriye teslim et\" butonunu kullan.";
  });
}

export async function releaseDeliverableAction(deliverableId: string, _prev: ActionState, _formData: FormData) {
  return run(async (adminId) => {
    await releaseDeliverable(deliverableId, adminId);
    return "Video müşteriye teslim edildi.";
  });
}

export async function updateProjectAction(projectId: string, _prev: ActionState, formData: FormData) {
  const formatRaw = String(formData.get("format") ?? "");
  const format = formatRaw ? z.enum(VIDEO_FORMATS).safeParse(formatRaw) : null;
  if (format && !format.success) return { ok: false, message: "Geçersiz format." };
  const dueRaw = String(formData.get("dueDate") ?? "");
  const dueDate = dueRaw ? parseDateInput(dueRaw) : null;
  const title = String(formData.get("title") ?? "").trim();
  return run(async () => {
    await updateProjectPlan(projectId, { format: format ? format.data : null, dueDate, title: title || undefined });
    return "Video planı güncellendi.";
  });
}

export async function refundPaymentAction(paymentId: string, _prev: ActionState, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (reason.length < 3) return { ok: false, message: "İade nedenini yaz." };
  return run(async (adminId) => {
    const changed = await markPaymentRefunded(paymentId, adminId, reason);
    return changed
      ? "Ödeme iade edildi olarak işaretlendi ve paket hakkı kapatıldı. (Para iadesini ödeme sağlayıcısının panelinden yapmayı unutma.)"
      : "Bu ödeme iade edilebilir durumda değil.";
  });
}
