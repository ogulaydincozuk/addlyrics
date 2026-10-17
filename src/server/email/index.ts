import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, smtpConfigured } from "../env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

let transporter: Transporter | null = null;

function smtp() {
  if (!transporter) {
    const e = env();
    transporter = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

/** Test ortamında gönderilen e-postalar burada birikir. */
export const sentEmails: EmailMessage[] = [];

/**
 * E-posta gönderir. Hata durumunda istisna fırlatmaz; ana iş akışı (ödeme, sipariş) e-posta
 * sağlayıcısındaki bir sorun yüzünden bozulmamalıdır. Başarı durumunu döndürür.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const e = env();
  if (e.NODE_ENV === "test") {
    sentEmails.push(message);
    return true;
  }
  if (e.EMAIL_DRIVER === "smtp") {
    if (!smtpConfigured()) {
      console.error("[email] EMAIL_DRIVER=smtp fakat SMTP_HOST tanımlı değil; e-posta gönderilmedi:", message.subject);
      return false;
    }
    try {
      await smtp().sendMail({ from: e.EMAIL_FROM, ...message });
      return true;
    } catch (err) {
      console.error("[email] Gönderim hatası:", (err as Error).message);
      return false;
    }
  }
  // console sürücüsü (geliştirme)
  console.info(
    `\n────────── [email:console] ──────────\nKime: ${message.to}\nKonu: ${message.subject}\n\n${message.text}\n─────────────────────────────────────\n`,
  );
  return true;
}

export function adminNotificationEmail() {
  return env().ADMIN_NOTIFICATION_EMAIL ?? null;
}
