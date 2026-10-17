import "server-only";
import type { NotificationType } from "@prisma/client";
import { db } from "./db";
import { adminNotificationEmail, sendEmail } from "./email";
import { renderEmail } from "./email/templates";

type EmailPart = {
  subject: string;
  heading?: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
  footnote?: string;
};

/** Müşteriye panel bildirimi oluşturur, istenirse e-posta da gönderir. */
export async function notifyUser(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  orderId?: string | null;
  email?: EmailPart;
}) {
  const notification = await db.notification.create({
    data: { userId: input.userId, type: input.type, title: input.title, body: input.body, orderId: input.orderId ?? null },
  });
  if (input.email) {
    const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true, name: true } });
    if (user) {
      const ok = await sendEmail(
        renderEmail(user.email, input.email.subject, {
          heading: input.email.heading ?? input.title,
          paragraphs: [`Merhaba ${user.name},`, ...input.email.paragraphs],
          cta: input.email.cta,
          footnote: input.email.footnote,
        }),
      );
      if (ok) await db.notification.update({ where: { id: notification.id }, data: { emailedAt: new Date() } });
    }
  }
  return notification;
}

/** Ekibe (tüm ADMIN hesapları + ADMIN_NOTIFICATION_EMAIL) bildirim. */
export async function notifyAdmins(input: { title: string; body: string; orderId?: string | null; href?: string }) {
  const admins = await db.user.findMany({ where: { role: "ADMIN", disabledAt: null }, select: { id: true } });
  if (admins.length) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "ADMIN_ALERT" as const,
        title: input.title,
        body: input.body,
        orderId: input.orderId ?? null,
      })),
    });
  }
  const to = adminNotificationEmail();
  if (to) {
    await sendEmail(
      renderEmail(to, `[AddLyrics] ${input.title}`, {
        heading: input.title,
        paragraphs: [input.body],
        cta: input.href ? { label: "Yönetim panelinde aç", href: input.href } : undefined,
      }),
    );
  }
}
