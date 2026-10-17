import "server-only";
import { randomInt } from "node:crypto";
import { MAX_ACCOUNTS_PER_PHONE, normalizePhone } from "@/lib/phone";
import { hmacSha256, randomToken, safeEqual, sha256Hex } from "../crypto";
import { db } from "../db";
import { DomainError } from "../domain/errors";
import { sendEmail } from "../email";
import { renderEmail } from "../email/templates";
import { appUrl, env } from "../env";
import { smsVerifier } from "./sms";

const SMS_CODE_TTL_MS = 10 * 60 * 1000;
const SMS_RESEND_COOLDOWN_MS = 60 * 1000;
const SMS_MAX_ATTEMPTS = 5;
const SMS_MAX_PER_HOUR = 5;
const SMS_MAX_PER_PHONE_PER_DAY = 10;
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_MAX_PER_HOUR = 5;

function codeHash(channel: string, target: string, code: string) {
  return hmacSha256(env().AUTH_SECRET, `${channel}:${target}:${code}`);
}

/** Bir telefon numarasına bağlı doğrulanmış hesap sayısı */
export async function verifiedAccountsForPhone(phone: string) {
  return db.phoneAccountSlot.count({ where: { phone } });
}

/** Kayıt ve telefon değişikliğinde erken kontrol (asıl sınır doğrulama anında veritabanında uygulanır). */
export async function assertPhoneHasCapacity(phone: string, userId?: string) {
  const slots = await db.phoneAccountSlot.findMany({ where: { phone }, select: { userId: true } });
  if (userId && slots.some((s) => s.userId === userId)) return;
  if (slots.length >= MAX_ACCOUNTS_PER_PHONE) {
    throw new DomainError(`Bu telefon numarasıyla en fazla ${MAX_ACCOUNTS_PER_PHONE} hesap doğrulanabilir.`, "PHONE_LIMIT");
  }
}

// ───────────────────────────── Telefon (SMS) ─────────────────────────────

/** Telefon numarasını kaydeder (doğrulanmamışsa) ve doğrulama kodu gönderir. */
export async function startPhoneVerification(userId: string, phoneInput: string, ip: string | null = null) {
  const normalized = normalizePhone(phoneInput);
  if (!normalized.ok) throw new DomainError(normalized.error, "PHONE_INVALID");
  const phone = normalized.e164;

  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
  if (user.phoneVerifiedAt) {
    if (user.phone === phone) throw new DomainError("Telefon numaran zaten doğrulanmış.", "ALREADY_VERIFIED");
    throw new DomainError("Doğrulanmış telefon numarası değiştirilemez. Destek ekibimizle iletişime geç.", "PHONE_LOCKED");
  }
  await assertPhoneHasCapacity(phone, userId);

  const verifier = smsVerifier();
  if (!verifier) {
    throw new DomainError(
      "SMS doğrulaması henüz etkin değil. Doğrulama sağlayıcısı yapılandırıldığında telefonunu doğrulayabileceksin.",
      "SMS_UNAVAILABLE",
    );
  }

  const now = Date.now();
  const recent = await db.verificationCode.findMany({
    where: { channel: "SMS", OR: [{ userId }, { target: phone }], createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } },
    select: { userId: true, target: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const lastForUser = recent.find((r) => r.userId === userId);
  if (lastForUser && now - lastForUser.createdAt.getTime() < SMS_RESEND_COOLDOWN_MS) {
    throw new DomainError("Yeni kod istemeden önce biraz bekle.", "COOLDOWN");
  }
  const lastHour = recent.filter((r) => r.userId === userId && now - r.createdAt.getTime() < 60 * 60 * 1000).length;
  const forPhoneToday = recent.filter((r) => r.target === phone).length;
  if (lastHour >= SMS_MAX_PER_HOUR || forPhoneToday >= SMS_MAX_PER_PHONE_PER_DAY) {
    throw new DomainError("Çok fazla doğrulama kodu istendi. Lütfen daha sonra tekrar dene.", "RATE");
  }

  if (user.phone !== phone) await db.user.update({ where: { id: userId }, data: { phone } });

  const code = verifier.managesCodes ? null : String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Önceki kullanılmamış kodlar geçersiz kılınır
  await db.verificationCode.updateMany({
    where: { userId, channel: "SMS", consumedAt: null },
    data: { consumedAt: new Date(), attempts: SMS_MAX_ATTEMPTS },
  });
  const record = await db.verificationCode.create({
    data: {
      userId,
      channel: "SMS",
      target: phone,
      codeHash: code ? codeHash("SMS", phone, code) : `provider:${verifier.name}`,
      expiresAt: new Date(now + SMS_CODE_TTL_MS),
      ip,
    },
  });
  try {
    await verifier.send(phone, code);
  } catch (err) {
    await db.verificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    console.error("[sms]", (err as Error).message);
    throw new DomainError("Doğrulama kodu gönderilemedi. Lütfen biraz sonra tekrar dene.", "SMS_FAILED");
  }
  return { phone, expiresAt: record.expiresAt, provider: verifier.name };
}

/**
 * Kodu doğrular ve telefonu hesaba bağlar. Telefon başına 2 hesap sınırı veritabanında uygulanır:
 * (phone, slot) benzersiz ve slot ∈ {1, 2}. Eşzamanlı isteklerde yalnızca boş bir yuva alınabilir.
 */
export async function confirmPhoneVerification(userId: string, codeInput: string) {
  const code = String(codeInput ?? "").replace(/\D/g, "");
  if (code.length < 4 || code.length > 10) throw new DomainError("Doğrulama kodunu eksiksiz yaz.", "CODE_INVALID");

  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
  if (user.phoneVerifiedAt) return { phone: user.phone!, alreadyVerified: true };
  if (!user.phone) throw new DomainError("Önce telefon numaranı gir.", "PHONE_MISSING");

  const record = await db.verificationCode.findFirst({
    where: { userId, channel: "SMS", target: user.phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt < new Date()) throw new DomainError("Kodun süresi dolmuş. Yeni kod iste.", "CODE_EXPIRED");

  // Deneme sayısı koşullu artırılır: kaba kuvvet denemeleri 5 ile sınırlı
  const bumped = await db.verificationCode.updateMany({
    where: { id: record.id, consumedAt: null, attempts: { lt: SMS_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (!bumped.count) throw new DomainError("Çok fazla hatalı deneme. Yeni kod iste.", "CODE_LOCKED");

  let valid: boolean;
  if (record.codeHash.startsWith("provider:")) {
    const verifier = smsVerifier();
    if (!verifier?.check) throw new DomainError("SMS doğrulaması şu an kullanılamıyor.", "SMS_UNAVAILABLE");
    valid = await verifier.check(user.phone, code);
  } else {
    valid = safeEqual(record.codeHash, codeHash("SMS", user.phone, code));
  }
  if (!valid) throw new DomainError("Doğrulama kodu hatalı.", "CODE_WRONG");

  const phone = user.phone;
  await db.$transaction(async (tx) => {
    const claimed = await claimPhoneSlot(tx, userId, phone);
    if (!claimed) {
      throw new DomainError(`Bu telefon numarasıyla en fazla ${MAX_ACCOUNTS_PER_PHONE} hesap doğrulanabilir.`, "PHONE_LIMIT");
    }
    await tx.verificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    await tx.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } });
  });
  return { phone, alreadyVerified: false };
}

type SlotClient = { $queryRaw: typeof db.$queryRaw };

/**
 * Telefon yuvası ayırır. ON CONFLICT DO NOTHING ile çakışmada hata yerine boş sonuç döner;
 * böylece işlem (transaction) iptal olmadan ikinci yuva denenebilir.
 */
export async function claimPhoneSlot(tx: SlotClient, userId: string, phone: string): Promise<boolean> {
  for (let slot = 1; slot <= MAX_ACCOUNTS_PER_PHONE; slot++) {
    const id = `ps_${randomToken(12)}`;
    const rows = await tx.$queryRaw<Array<{ slot: number }>>`
      INSERT INTO "PhoneAccountSlot" ("id", "phone", "slot", "userId", "createdAt")
      VALUES (${id}, ${phone}, ${slot}, ${userId}, NOW())
      ON CONFLICT DO NOTHING
      RETURNING "slot"`;
    if (rows.length) return true;
  }
  // Kullanıcının zaten aynı numaraya ait yuvası varsa (tekrarlanan istek) başarılı sayılır
  const existing = await tx.$queryRaw<Array<{ phone: string }>>`SELECT "phone" FROM "PhoneAccountSlot" WHERE "userId" = ${userId}`;
  return existing.length > 0 && existing[0]!.phone === phone;
}

// ───────────────────────────── E-posta ─────────────────────────────

export async function sendEmailVerification(userId: string, nextPath?: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true, emailVerifiedAt: true } });
  if (user.emailVerifiedAt) return { alreadyVerified: true };

  const now = Date.now();
  const recent = await db.verificationCode.findMany({
    where: { userId, channel: "EMAIL", createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (recent[0] && now - recent[0].createdAt.getTime() < EMAIL_RESEND_COOLDOWN_MS) {
    throw new DomainError("Yeni bağlantı istemeden önce biraz bekle.", "COOLDOWN");
  }
  if (recent.length >= EMAIL_MAX_PER_HOUR) throw new DomainError("Çok fazla doğrulama e-postası istendi. Daha sonra tekrar dene.", "RATE");

  const token = randomToken(32);
  await db.verificationCode.create({
    data: { userId, channel: "EMAIL", target: user.email, codeHash: sha256Hex(token), expiresAt: new Date(now + EMAIL_TOKEN_TTL_MS) },
  });
  const next = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? `&next=${encodeURIComponent(nextPath)}` : "";
  const sent = await sendEmail(
    renderEmail(user.email, "AddLyrics e-posta doğrulama", {
      heading: "E-posta adresini doğrula",
      paragraphs: [`Merhaba ${user.name},`, "Hesabını kullanmaya devam etmek için e-posta adresini doğrula. Bağlantı 24 saat geçerlidir."],
      cta: { label: "E-postamı doğrula", href: appUrl(`/e-posta-dogrula?token=${encodeURIComponent(token)}${next}`) },
      footnote: "Bu hesabı sen oluşturmadıysan bu e-postayı yok sayabilirsin.",
    }),
  );
  if (!sent) throw new DomainError("Doğrulama e-postası gönderilemedi. Lütfen biraz sonra tekrar dene.", "EMAIL_FAILED");
  return { alreadyVerified: false };
}

/** E-posta bağlantısındaki belirteci doğrular; başarıyla doğrulanan kullanıcının kimliğini döner. */
export async function confirmEmailToken(token: string) {
  if (!token || token.length < 20) return null;
  const record = await db.verificationCode.findFirst({
    where: { channel: "EMAIL", codeHash: sha256Hex(token), consumedAt: null },
    include: { user: { select: { email: true } } },
  });
  if (!record || record.expiresAt < new Date() || record.user.email !== record.target) return null;
  const claimed = await db.verificationCode.updateMany({ where: { id: record.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (!claimed.count) return null;
  await db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  return record.userId;
}

export async function verificationStatus(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true },
  });
  return {
    email: user.email,
    phone: user.phone,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    smsAvailable: Boolean(smsVerifier()),
  };
}
