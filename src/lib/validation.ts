// Ortak doğrulama şemaları. İstemci adım doğrulamasında ve sunucuda aynı kurallar kullanılır;
// sunucu her zaman yeniden doğrular (istemciye güvenilmez).
import { z } from "zod";
import { FOOTAGE_SOURCES, PLATFORMS, RELEASE_STATUSES, VIDEO_FORMATS, VIDEO_STYLES } from "./enums";

const trimmed = (max: number) => z.string().trim().max(max, `En fazla ${max} karakter olabilir.`);
const optionalTrimmed = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), trimmed(max).optional());

export const httpUrl = z
  .string()
  .trim()
  .max(500, "Bağlantı çok uzun.")
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Geçerli bir bağlantı gir (https:// ile başlamalı).");

const optionalUrl = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), httpUrl.optional());

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Geçerli bir e-posta adresi gir."));

export const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı.")
  .max(128, "Şifre en fazla 128 karakter olabilir.")
  .refine((v) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(v) && /\d/.test(v), "Şifre en az bir harf ve bir rakam içermeli.");

export const registerSchema = z.object({
  name: trimmed(100).min(2, "Adını ve soyadını yaz."),
  artistName: optionalTrimmed(100),
  email: emailSchema,
  // Telefon zorunlu; sunucuda ülke koduyla normalize edilir (src/lib/phone.ts)
  phone: trimmed(30).min(7, "Telefon numaranı yaz."),
  password: passwordSchema,
  kvkk: z.literal("on", { error: "Devam etmek için aydınlatma metnini onaylamalısın." }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Şifreni yaz.").max(128),
});

// ─────────────────────────── Sipariş ───────────────────────────

export const songStepSchema = z.object({
  artistName: trimmed(120).min(1, "Sanatçı adını yaz."),
  title: trimmed(160).min(1, "Şarkı adını yaz."),
  releaseStatus: z.enum(RELEASE_STATUSES, { error: "Yayınlanma durumunu seç." }),
  language: trimmed(40).min(2, "Şarkı dilini seç."),
  lyrics: optionalTrimmed(20000),
  streamingUrl: optionalUrl,
});

export const styleStepSchema = z
  .object({
    style: z.enum(VIDEO_STYLES, { error: "Bir video tarzı seç." }),
    customStyleRequest: optionalTrimmed(2000),
    footageSource: z.enum(FOOTAGE_SOURCES).optional(),
    fontPreference: optionalTrimmed(200),
    colorPreference: optionalTrimmed(200),
    referenceUrl: optionalUrl,
    notesForEditor: optionalTrimmed(4000),
  })
  .superRefine((v, ctx) => {
    if (v.style === "CUSTOM" && !v.customStyleRequest) {
      ctx.addIssue({ code: "custom", path: ["customStyleRequest"], message: "Özel tasarım talebini kısaca anlat." });
    }
    if (v.style === "FILM_EDIT" && !v.footageSource) {
      ctx.addIssue({ code: "custom", path: ["footageSource"], message: "Görüntü kaynağını seç." });
    }
  });

export const formatStepSchema = z
  .object({
    formats: z.array(z.enum(VIDEO_FORMATS)).min(1, "En az bir video formatı seç."),
    platforms: z.array(z.enum(PLATFORMS)).min(1, "En az bir hedef platform seç."),
    otherPlatform: optionalTrimmed(100),
    videoCount: z.coerce.number().int().min(1, "En az 1 video seçmelisin.").max(200),
  })
  .superRefine((v, ctx) => {
    if (v.platforms.includes("OTHER") && !v.otherPlatform) {
      ctx.addIssue({ code: "custom", path: ["otherPlatform"], message: "Diğer platformu yaz." });
    }
  });

export const orderInputSchema = z.object({
  song: songStepSchema,
  style: styleStepSchema,
  format: formatStepSchema,
  fileIds: z.array(z.string().min(1).max(40)).max(40),
  rightsConfirmed: z.literal(true, { error: "Kullanım haklarına ilişkin onayı vermelisin." }),
  termsAccepted: z.literal(true, { error: "Hizmet koşullarını onaylamalısın." }),
});

export type OrderInput = z.infer<typeof orderInputSchema>;

export const billingSchema = z.object({
  billingName: trimmed(120).min(3, "Fatura için ad soyad yaz."),
  billingPhone: trimmed(20).regex(/^\+?[0-9\s()-]{10,20}$/, "Geçerli bir telefon numarası yaz."),
  billingCity: trimmed(60).min(2, "Şehir yaz."),
  billingAddress: trimmed(400).min(10, "Fatura adresini yaz."),
  billingIdentityNumber: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{10}$/, "T.C. kimlik numarası 11 haneli olmalı.")
      .optional(),
  ),
  distanceSales: z.literal("on", { error: "Ön bilgilendirme formu ve mesafeli satış sözleşmesini onaylamalısın." }),
});

// ─────────────────────────── Ücretsiz deneme ───────────────────────────

export const trialInputSchema = z.object({
  song: songStepSchema.extend({
    lyrics: trimmed(20000).min(20, "Şarkı sözlerini satır satır yaz (en az 20 karakter)."),
  }),
  preferredStyle: z.enum(VIDEO_STYLES).optional(),
  footageSource: z.enum(FOOTAGE_SOURCES).optional(),
  formats: z.array(z.enum(VIDEO_FORMATS)).min(1, "En az bir video formatı seç.").max(3),
  notesForEditor: optionalTrimmed(4000),
  fileIds: z.array(z.string().min(1).max(40)).min(1, "Şarkının ses dosyasını yükle.").max(20),
  rightsConfirmed: z.literal(true, { error: "Kullanım haklarına ilişkin onayı vermelisin." }),
  materialsMatchConfirmed: z.literal(true, { error: "Ses dosyası ile sözlerin aynı şarkıya ait olduğunu onaylamalısın." }),
  termsAccepted: z.literal(true, { error: "Ücretsiz deneme koşullarını onaylamalısın." }),
});
export type TrialInput = z.infer<typeof trialInputSchema>;

export const trialResubmitSchema = z.object({
  lyrics: trimmed(20000).min(20, "Şarkı sözlerini satır satır yaz (en az 20 karakter)."),
  notesForEditor: optionalTrimmed(4000),
  message: optionalTrimmed(2000),
});

/** Sipariş sayfasından ekibe mesaj / soruya yanıt */
export const orderMessageSchema = z.object({
  orderNumber: z.string().min(1).max(40),
  message: trimmed(3000).min(2, "Mesajını yaz."),
});

export const contactSchema = z.object({
  name: trimmed(100).min(2, "Adını yaz."),
  email: emailSchema,
  subject: optionalTrimmed(150),
  message: trimmed(4000).min(10, "Mesajın en az 10 karakter olmalı."),
  // Bot tuzağı: görünmez alan doluysa mesaj kaydedilmez
  website: z.string().max(0).optional(),
});

/** zod hatalarını { "song.title": "mesaj" } biçimine çevirir. */
export function flattenErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
