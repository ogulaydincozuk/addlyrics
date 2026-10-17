import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DEFAULT_SETTINGS, SETTING_SCHEMAS, type SettingKey, type SettingValue } from "@/content/settings";
import { defaultLocale, type Locale } from "@/i18n/config";
import type { VideoFormatValue, VideoStyleValue } from "@/lib/enums";
import { comparePackages, perMonthKurus, perVideoKurus, totalVideoCount, type SaleState } from "@/lib/packages";
import { pickActiveAnnouncement } from "@/lib/announcements";
import { db } from "../db";
import { packageSaleState } from "../domain/packages";
import { getTikTokThumbnail } from "../embeds";
import { samplePackagesAllowed } from "../env";
import { readSystemSetting } from "../system-settings";

/** Önbellek etiketleri — admin değişikliklerinde updateTag/revalidateTag ile yenilenir. */
export const CACHE_TAGS = {
  packages: "packages",
  portfolio: "portfolio",
  faq: "faq",
  settings: "settings",
  pages: "pages",
  announcements: "announcements",
} as const;

export type PublicPackage = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  durationMonths: number;
  currency: string;
  /** Örnek fiyatlar üretimde asla gösterilmez: bu durumda alanlar null döner */
  priceKurus: number | null;
  videoCount: number | null;
  bonusVideoCount: number;
  /** Teslim edilecek toplam video (bonus dahil) */
  totalVideos: number | null;
  deliveryTerms: string | null;
  deliveryDays: number | null;
  includedFormats: VideoFormatValue[];
  includedStyles: VideoStyleValue[];
  features: string[];
  isFeatured: boolean;
  isSample: boolean;
  saleState: SaleState;
  perVideoKurus: number | null;
  perMonthKurus: number | null;
  savingsPercent: number | null;
};

export async function getPublicPackages(): Promise<PublicPackage[]> {
  "use cache";
  cacheTag(CACHE_TAGS.packages);
  cacheLife("minutes");

  const rows = await db.package.findMany({
    where: { status: "PUBLISHED" },
    include: { channelListings: true },
    orderBy: [{ sortOrder: "asc" }, { durationMonths: "asc" }],
  });
  const showSample = samplePackagesAllowed();
  const visible = rows.map((p) => {
    const hidePricing = p.isSample && !showSample;
    return {
      ...p,
      priceKurus: hidePricing ? null : p.priceKurus,
      videoCount: hidePricing ? null : p.videoCount,
      deliveryTerms: hidePricing ? null : p.deliveryTerms,
    };
  });
  const comparison = comparePackages(visible);
  return visible.map((p, i) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    durationMonths: p.durationMonths,
    currency: p.currency,
    priceKurus: p.priceKurus,
    videoCount: p.videoCount,
    bonusVideoCount: p.videoCount != null ? p.bonusVideoCount : 0,
    totalVideos: totalVideoCount(p),
    deliveryTerms: p.deliveryTerms,
    deliveryDays: p.deliveryDays,
    includedFormats: p.includedFormats,
    includedStyles: p.includedStyles,
    features: p.features,
    isFeatured: p.isFeatured,
    isSample: p.isSample,
    saleState: packageSaleState(rows[i]!),
    perVideoKurus: perVideoKurus(p),
    perMonthKurus: perMonthKurus(p),
    savingsPercent: comparison[i]!.savingsPercent,
  }));
}

export async function getPublicPackage(slug: string) {
  const all = await getPublicPackages();
  return all.find((p) => p.slug === slug) ?? null;
}

export type PublicPortfolioItem = {
  id: string;
  title: string;
  description: string;
  category: "FILM_EDIT" | "MINIMAL" | "MUSIC_VIDEO" | "CUSTOM";
  orientation: VideoFormatValue;
  videoUrl: string | null;
  posterUrl: string | null;
  /** Resmî oynatıcıyla gömülen harici video (ör. TikTok) */
  embed: { provider: "tiktok"; id: string; handle: string | null; sourceUrl: string } | null;
  demoPreset: string | null;
  isDemo: boolean;
};

export async function getPublicPortfolio(): Promise<PublicPortfolioItem[]> {
  "use cache";
  cacheTag(CACHE_TAGS.portfolio);
  cacheLife("minutes");
  const rows = await db.portfolioItem.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return Promise.all(
    rows.map(async (r) => {
      const embed =
        r.embedProvider === "tiktok" && r.embedId && r.sourceUrl
          ? { provider: "tiktok" as const, id: r.embedId, handle: r.authorHandle, sourceUrl: r.sourceUrl }
          : null;
      const uploadedPoster = r.posterFileId ? `/api/media/${r.posterFileId}` : null;
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        orientation: r.orientation,
        videoUrl: r.videoFileId ? `/api/media/${r.videoFileId}` : r.externalVideoUrl,
        posterUrl: uploadedPoster ?? (embed ? await getTikTokThumbnail(embed.sourceUrl) : null),
        embed,
        demoPreset: r.demoPreset,
        isDemo: r.isDemo,
      };
    }),
  );
}

export async function getPublicFaq(locale: Locale = defaultLocale) {
  "use cache";
  cacheTag(CACHE_TAGS.faq);
  cacheLife("minutes");
  return db.faqItem.findMany({
    where: { locale, published: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, question: true, answer: true },
  });
}

/** Ayarı veritabanından okur; kayıt yoksa veya geçersizse varsayılanı döndürür. */
export async function getSetting<K extends SettingKey>(key: K, locale: Locale = defaultLocale): Promise<SettingValue<K>> {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  cacheLife("minutes");
  const row = await db.siteSetting.findUnique({ where: { key_locale: { key, locale } } });
  const fallback = DEFAULT_SETTINGS[key];
  if (!row) return fallback;
  const parsed = SETTING_SCHEMAS[key].safeParse({ ...fallback, ...(row.value as object) });
  return (parsed.success ? parsed.data : fallback) as SettingValue<K>;
}

export async function getContentPage(slug: string, locale: Locale = defaultLocale) {
  "use cache";
  cacheTag(CACHE_TAGS.pages);
  cacheLife("minutes");
  return db.contentPage.findUnique({
    where: { slug_locale: { slug, locale } },
    select: { slug: true, title: true, metaDescription: true, body: true, isLegal: true, reviewedAt: true, updatedAt: true },
  });
}

/** Ücretsiz deneme tanıtımı gösterilsin mi (deneme açık ve kapasite dolmamış). */
export async function getTrialPromoAvailability() {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  cacheLife("minutes");
  const settings = await readSystemSetting("system.trial");
  if (!settings.enabled) return false;
  const open = await db.trialApplication.count({
    where: { status: { in: ["RECEIVED", "FILES_CHECK", "NEEDS_INFO", "QUEUED", "IN_PRODUCTION", "EDITOR_REVIEW", "FAILED"] } },
  });
  return open < settings.maxOpenTrials;
}

/** Yayında ve tarih aralığındaki en öncelikli duyuru; yoksa null (sitede duyuru alanı çizilmez). */
export async function getActiveAnnouncement() {
  "use cache";
  cacheTag(CACHE_TAGS.announcements);
  cacheLife("minutes");
  const items = await db.announcement.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      body: true,
      linkLabel: true,
      linkUrl: true,
      display: true,
      status: true,
      startsAt: true,
      endsAt: true,
      priority: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
  return pickActiveAnnouncement(items);
}
