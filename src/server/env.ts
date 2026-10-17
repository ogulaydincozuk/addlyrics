import "server-only";
import { z } from "zod";

/**
 * Ortam değişkenleri tek noktadan, doğrulanarak okunur.
 * Boş string değerler "tanımsız" kabul edilir.
 */

const optionalString = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());
const bool = (fallback: boolean) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : String(v).toLowerCase()),
    z
      .enum(["true", "false", "1", "0", "yes", "no"])
      .optional()
      .transform((v) => (v === undefined ? fallback : v === "true" || v === "1" || v === "yes")),
  );
const int = (fallback: number) =>
  z.preprocess((v) => (v === "" || v === undefined ? fallback : Number(v)), z.number().int().positive());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().default("http://localhost:3000")),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET en az 32 karakter olmalı"),
  DATABASE_URL: z.string().min(1),

  PAYMENT_PROVIDER: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["mock", "iyzico", "shopify", "none"]).default("none"),
  ),
  ALLOW_TEST_PAYMENTS: bool(false),

  IYZICO_API_KEY: optionalString,
  IYZICO_SECRET_KEY: optionalString,
  IYZICO_BASE_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().default("https://sandbox-api.iyzipay.com")),

  SHOPIFY_STORE_DOMAIN: optionalString,
  SHOPIFY_STOREFRONT_ACCESS_TOKEN: optionalString,
  SHOPIFY_API_VERSION: z.preprocess((v) => (v === "" ? undefined : v), z.string().default("2026-07")),
  SHOPIFY_ADMIN_ACCESS_TOKEN: optionalString,
  SHOPIFY_WEBHOOK_SECRET: optionalString,

  ALLOW_SAMPLE_PACKAGES: bool(false),

  STORAGE_DRIVER: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["local", "s3", "vercel-blob"]).default("local")),
  STORAGE_LOCAL_DIR: z.preprocess((v) => (v === "" ? undefined : v), z.string().default("./storage")),
  S3_BUCKET: optionalString,
  S3_REGION: z.preprocess((v) => (v === "" ? undefined : v), z.string().default("auto")),
  S3_ENDPOINT: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_FORCE_PATH_STYLE: bool(false),

  UPLOAD_MAX_AUDIO_MB: int(200),
  UPLOAD_MAX_VIDEO_MB: int(2048),
  UPLOAD_MAX_IMAGE_MB: int(20),
  UPLOAD_MAX_DOC_MB: int(10),

  EMAIL_DRIVER: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["console", "smtp"]).default("console")),
  EMAIL_FROM: z.preprocess((v) => (v === "" ? undefined : v), z.string().default("AddLyrics <bildirim@example.com>")),
  SMTP_HOST: optionalString,
  SMTP_PORT: int(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  ADMIN_NOTIFICATION_EMAIL: optionalString,

  // SMS doğrulama (telefon). "console" yalnızca geliştirme içindir; kod sunucu günlüğüne yazılır.
  SMS_PROVIDER: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["none", "console", "twilio"]).default("none")),
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_VERIFY_SERVICE_SID: optionalString,

  // Ön izleme kesiti/filigran için ffmpeg (overlay ve boxblur filtreleri olan tam sürüm önerilir)
  FFMPEG_PATH: optionalString,
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Ortam değişkenleri geçersiz:\n${issues}\n.env.example dosyasına bakın.`);
  }
  cached = parsed.data;
  return cached;
}

/** Testlerde ortam değişkenleri değiştirildiğinde önbelleği temizler. */
export function resetEnvCache() {
  cached = null;
}

export const isProduction = () => env().NODE_ENV === "production";

export function appUrl(path = "/") {
  return new URL(path, env().APP_URL).toString();
}

// ─────────────── Özellik durumları (admin panelindeki entegrasyon ekranı da kullanır) ───────────────

export function testPaymentsAllowed() {
  const e = env();
  return e.NODE_ENV !== "production" && e.ALLOW_TEST_PAYMENTS;
}

export function samplePackagesAllowed() {
  const e = env();
  return e.NODE_ENV !== "production" && e.ALLOW_SAMPLE_PACKAGES;
}

export function iyzicoConfigured() {
  const e = env();
  return Boolean(e.IYZICO_API_KEY && e.IYZICO_SECRET_KEY);
}

export function shopifyStorefrontConfigured() {
  const e = env();
  return Boolean(e.SHOPIFY_STORE_DOMAIN && e.SHOPIFY_STOREFRONT_ACCESS_TOKEN);
}

export function shopifyWebhooksConfigured() {
  return Boolean(env().SHOPIFY_WEBHOOK_SECRET);
}

export function s3Configured() {
  const e = env();
  return Boolean(e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY);
}

export function smtpConfigured() {
  const e = env();
  return Boolean(e.SMTP_HOST);
}

/** SMS doğrulamasını gerçekten gönderebilen sağlayıcı var mı? */
export function smsProvider(): "twilio" | "console" | null {
  const e = env();
  if (e.SMS_PROVIDER === "twilio") {
    return e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_VERIFY_SERVICE_SID ? "twilio" : null;
  }
  // Konsol sağlayıcısı canlı ortamda asla kullanılmaz
  if (e.SMS_PROVIDER === "console" && e.NODE_ENV !== "production") return "console";
  return null;
}

/** Gönderilen e-postalar gerçekten alıcıya ulaşıyor mu? (canlıda SMTP gerekir; geliştirmede konsol yeterli) */
export function emailDeliverable() {
  const e = env();
  if (e.NODE_ENV !== "production") return true;
  return e.EMAIL_DRIVER === "smtp" && smtpConfigured();
}

/**
 * Ücretsiz deneme canlıda yalnızca telefon (SMS) ve e-posta doğrulaması gerçekten çalışırken açılır;
 * aksi halde ziyaretçiye tamamlayamayacağı bir akış gösterilmez.
 */
export function trialPrerequisitesReady() {
  return smsProvider() !== null && emailDeliverable();
}

export function ffmpegPath() {
  return env().FFMPEG_PATH ?? null;
}
