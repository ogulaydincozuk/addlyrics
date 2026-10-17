"use server";

import { redirect } from "next/navigation";
import { formValues, type ActionState } from "@/lib/action-state";
import { emailSchema, flattenErrors, loginSchema, passwordSchema, registerSchema } from "@/lib/validation";
import { messages } from "@/i18n/config";
import { safeNextPath } from "@/server/auth/guards";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroyAllSessions, destroySession } from "@/server/auth/session";
import { randomToken, sha256Hex } from "@/server/crypto";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { renderEmail } from "@/server/email/templates";
import { appUrl } from "@/server/env";
import { normalizePhone } from "@/lib/phone";
import { isDomainError } from "@/server/domain/errors";
import { rateLimitByIp } from "@/server/rate-limit";
import { assertPhoneHasCapacity, sendEmailVerification } from "@/server/verification/service";
import { KVKK_VERSION } from "@/lib/legal";

const t = messages().auth;

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["email"]);
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };

  const limit = await rateLimitByIp("login", parsed.data.email);
  if (!limit.ok) return { ok: false, message: t.tooMany, values };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    await burnPasswordCheck(parsed.data.password);
    return { ok: false, message: t.invalidCredentials, values };
  }
  const valid = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!valid || user.disabledAt) return { ok: false, message: t.invalidCredentials, values };

  await createSession(user.id);
  const home = user.role === "ADMIN" ? "/admin" : user.role === "PARTNER" ? "/ortak" : "/panel";
  redirect(safeNextPath(String(formData.get("next") ?? ""), home));
}

export async function register(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // kvkk: işaretliyse "on" — hata sonrası onay kutusu da korunur
  const values = formValues(formData, ["name", "artistName", "email", "phone", "kvkk"]);
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    artistName: formData.get("artistName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    kvkk: formData.get("kvkk") ?? undefined,
  });
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone.ok) return { ok: false, errors: { phone: phone.error }, values };

  const limit = await rateLimitByIp("register");
  if (!limit.ok) return { ok: false, message: t.tooMany, values };

  const exists = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (exists) return { ok: false, errors: { email: t.emailTaken }, values };
  try {
    // Erken kontrol; asıl sınır telefon doğrulanırken veritabanında uygulanır
    await assertPhoneHasCapacity(phone.e164);
  } catch (err) {
    if (isDomainError(err)) return { ok: false, errors: { phone: err.message }, values };
    throw err;
  }

  const now = new Date();
  const user = await db.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      artistName: parsed.data.artistName ?? null,
      phone: phone.e164,
      kvkkAcceptedAt: now,
      kvkkVersion: KVKK_VERSION,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });
  await createSession(user.id);
  const next = safeNextPath(String(formData.get("next") ?? ""), "/panel");
  // Doğrulama e-postası hemen gönderilir; gönderilemezse doğrulama sayfasından tekrar istenebilir
  await sendEmailVerification(user.id, next).catch(() => undefined);
  redirect(`/panel/dogrulama?next=${encodeURIComponent(next)}`);
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["email"]);
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, errors: { email: parsed.error.issues[0]!.message }, values };

  const limit = await rateLimitByIp("passwordReset");
  if (!limit.ok) return { ok: false, message: t.tooMany, values };

  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (user && !user.disabledAt) {
    const token = randomToken(32);
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await sendEmail(
      renderEmail(user.email, "AddLyrics şifre sıfırlama", {
        heading: "Şifreni sıfırla",
        paragraphs: [
          `Merhaba ${user.name},`,
          "Hesabın için şifre sıfırlama talebi aldık. Aşağıdaki bağlantı 1 saat boyunca geçerlidir.",
        ],
        cta: { label: "Yeni şifre belirle", href: appUrl(`/sifre-sifirla?token=${encodeURIComponent(token)}`) },
        footnote: "Bu talebi sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmeyecek.",
      }),
    );
  }
  // Hesap olup olmadığı bilgisi sızdırılmaz
  return { ok: true, message: t.resetSent };
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { ok: false, errors: { password: parsed.error.issues[0]!.message } };

  const record = token ? await db.passwordResetToken.findUnique({ where: { tokenHash: sha256Hex(token) } }) : null;
  if (!record || record.usedAt || record.expiresAt < new Date()) return { ok: false, message: t.resetInvalid };

  const claimed = await db.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  if (!claimed.count) return { ok: false, message: t.resetInvalid };

  await db.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(parsed.data) } });
  await destroyAllSessions(record.userId);
  await createSession(record.userId);
  redirect("/panel");
}
