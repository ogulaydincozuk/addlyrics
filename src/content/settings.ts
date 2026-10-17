// Admin panelinden düzenlenebilen site içerikleri: şemalar ve varsayılan (Türkçe) değerler.
// Veritabanında kayıt yoksa varsayılan kullanılır. Yeni dil eklerken her anahtar için
// locale'e özel varsayılan eklenebilir.
import { z } from "zod";

const text = (max = 400) => z.string().trim().max(max);

export const homeSchema = z.object({
  heroTitle: text(160),
  heroDescription: text(600),
  heroPrimaryCta: text(40),
  heroSecondaryCta: text(40),
  trustPoints: z.array(text(120)).length(3),
  stylesTitle: text(160),
  styles: z.object({
    FILM_EDIT: z.object({ title: text(60), description: text(300) }),
    MINIMAL: z.object({ title: text(60), description: text(300) }),
    MUSIC_VIDEO: z.object({ title: text(60), description: text(300) }),
  }),
  stepsTitle: text(160),
  steps: z.array(z.object({ title: text(80), description: text(300) })).length(4),
  packagesTitle: text(160),
  packagesDescription: text(400),
  portfolioTitle: text(160),
  portfolioDescription: text(400),
  whyTitle: text(160),
  whyPoints: z.array(text(200)).min(1).max(8),
  faqTitle: text(160),
  finalTitle: text(160),
  finalDescription: text(400),
  finalCta: text(40),
});

export const contactSchema = z.object({
  companyName: text(200),
  email: text(200),
  phone: text(40),
  whatsapp: text(40),
  address: text(400),
  mersisNo: text(40),
  taxInfo: text(200),
  kepAddress: text(200),
  instagram: text(200),
  workingHours: text(200),
});

export const seoSchema = z.object({
  siteTitle: text(120),
  siteDescription: text(300),
});

export const SETTING_SCHEMAS = {
  home: homeSchema,
  contact: contactSchema,
  seo: seoSchema,
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>;

export const DEFAULT_SETTINGS: { [K in SettingKey]: SettingValue<K> } = {
  home: {
    heroTitle: "Şarkın İçin Lyrics Videolar. Tek Bir Yerden.",
    heroDescription:
      "Her video için ayrı ayrı editör aramakla uğraşma. AddLyrics ile çalışan editörler şarkına özel lyrics videolar hazırlasın. Paketini seç, şarkını gönder ve müziğini tanıtmaya devam et.",
    heroPrimaryCta: "Paketleri İncele",
    heroSecondaryCta: "Video Örneklerini Gör",
    trustPoints: [
      "Gerçek editörler tarafından hazırlanır.",
      "Şarkına ve tercihlerine özel tasarlanır.",
      "Paketine göre planlanan video teslimatı.",
    ],
    stylesTitle: "Şarkına Hangi Görsel Tarz Yakışıyor?",
    styles: {
      FILM_EDIT: {
        title: "Film Edit Lyrics",
        description:
          "Sinematik görüntüler, film atmosferi ve şarkı sözlerini birleştiren videolar. Yalnızca lisanslı stok görüntüler veya kullanım hakkına sahip olduğun görüntülerle hazırlanır.",
      },
      MINIMAL: {
        title: "Minimal Lyrics",
        description: "Sade arka planlar, güçlü tipografi ve şarkı sözlerine odaklanan görseller.",
      },
      MUSIC_VIDEO: {
        title: "Music Video Lyrics",
        description: "Sanatçının kendi müzik klibi üzerine senkronize şarkı sözleri.",
      },
    },
    stepsTitle: "Nasıl Çalışır?",
    steps: [
      { title: "Paketini seç.", description: "İhtiyacına göre 1, 2 veya 3 aylık paketi seç." },
      { title: "Şarkını gönder.", description: "Şarkı dosyanı, sözlerini ve varsa müzik klibini yükle." },
      {
        title: "Editörlerimiz videolarını hazırlasın.",
        description: "Ekibimiz siparişini incelesin ve belirttiğin görsel tarza göre üretim sürecini yürütsün.",
      },
      {
        title: "Videolarını teslim al.",
        description: "Tamamlanan videolarını müşteri panelinden görüntüle ve indir.",
      },
    ],
    packagesTitle: "Sana Uygun Lyrics Video Paketini Seç.",
    packagesDescription:
      "Tek seferlik ödeme, otomatik yenileme yok. Her pakette toplam video sayısını ve video başına maliyeti açıkça görürsün.",
    portfolioTitle: "AddLyrics Tarzını Keşfet.",
    portfolioDescription: "Film edit, minimal ve klip üzerine lyrics videoların farklı formatlardaki görünümünü incele.",
    whyTitle: "Sen Müziğine Odaklan. Video Sürecini Biz Üstlenelim.",
    whyPoints: [
      "Her video için ayrı editör aramak zorunda kalmazsın.",
      "Şarkına uygun bir görsel tarz seçebilirsin.",
      "Paket sayesinde içerik bütçeni önceden planlayabilirsin.",
      "Siparişlerini tek bir panelden takip edebilirsin.",
      "Tamamlanan videolarını dijital olarak teslim alabilirsin.",
    ],
    faqTitle: "Sıkça Sorulan Sorular",
    finalTitle: "Şarkın İçin İlk Paketini Seç.",
    finalDescription: "Şarkına özel lyrics videolar için ihtiyacın olan paketi seç ve siparişini kolayca oluştur.",
    finalCta: "Paketleri Keşfet",
  },
  contact: {
    companyName: "",
    email: "",
    phone: "",
    whatsapp: "",
    address: "",
    mersisNo: "",
    taxInfo: "",
    kepAddress: "",
    instagram: "",
    workingHours: "",
  },
  seo: {
    siteTitle: "AddLyrics — Şarkına Özel Lyrics Video Hazırlama",
    siteDescription:
      "Rap, pop ve bağımsız sanatçılar için profesyonel editörlerin hazırladığı şarkıya özel lyrics videolar. Aylık lyrics video paketi seç, şarkını gönder, videolarını panelden teslim al.",
  },
};

// ─────────────────────────── Sabit içerik sayfaları ───────────────────────────

export const CONTENT_PAGE_SLUGS = [
  "hakkimizda",
  "gizlilik-politikasi",
  "kullanim-kosullari",
  "iptal-ve-iade-politikasi",
  "kvkk-aydinlatma-metni",
  "mesafeli-satis-sozlesmesi",
  "on-bilgilendirme-formu",
  "ucretsiz-deneme-kosullari",
] as const;
export type ContentPageSlug = (typeof CONTENT_PAGE_SLUGS)[number];
