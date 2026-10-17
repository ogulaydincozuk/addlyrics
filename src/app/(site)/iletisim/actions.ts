"use server";

import { formValues, type ActionState } from "@/lib/action-state";
import { contactSchema, flattenErrors } from "@/lib/validation";
import { db } from "@/server/db";
import { notifyAdmins } from "@/server/notify";
import { rateLimitByIp } from "@/server/rate-limit";

export async function sendContactMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["name", "email", "subject", "message"]);
  const parsed = contactSchema.safeParse({ ...values, website: String(formData.get("website") ?? "") });
  if (!parsed.success) {
    // Bot tuzağı dolduysa sessizce başarılı görün
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { ok: true, message: "Mesajın alındı." };
    return { ok: false, errors: flattenErrors(parsed.error), values };
  }
  const limit = await rateLimitByIp("contact");
  if (!limit.ok) return { ok: false, message: "Çok fazla mesaj gönderildi. Lütfen daha sonra tekrar dene.", values };

  const { name, email, subject, message } = parsed.data;
  await db.contactMessage.create({ data: { name, email, subject: subject ?? null, message } });
  await notifyAdmins({
    title: `Yeni iletişim mesajı: ${subject ?? name}`,
    body: `${name} <${email}>: ${message.slice(0, 500)}`,
    href: "/admin/mesajlar",
  });
  return { ok: true, message: "Mesajın alındı. En kısa sürede e-posta ile dönüş yapacağız." };
}
