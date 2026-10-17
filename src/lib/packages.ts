// Paket iş kuralları — saf fonksiyonlar (istemci ve sunucuda kullanılabilir, testleri tests/packages.test.ts).
import type { VideoFormatValue, VideoStyleValue } from "./enums";

export type PackageLike = {
  id: string;
  slug: string;
  name: string;
  durationMonths: number;
  priceKurus: number | null;
  currency: string;
  videoCount: number | null;
  /** Ek (bonus) video sayısı; teslim edilecek toplam = videoCount + bonusVideoCount */
  bonusVideoCount: number;
  deliveryTerms: string | null;
  deliveryDays: number | null;
  includedFormats: VideoFormatValue[];
  includedStyles: VideoStyleValue[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isSample: boolean;
  /** Ücretsiz denemeden satın almada 3 deneme videosu paket hakkına dahil mi (varsayılan: evet) */
  trialCountsTowardPackage?: boolean;
  /** Denemeden satın almada kalan ilk teslim videoları için iş günü (boşsa sistem ayarı) */
  trialConversionBusinessDays?: number | null;
};

/**
 * Hazırlık süreci (AddLyrics kararı): paketlerde revizyon hakkı yoktur. Üretime başlamadan önce
 * ekip gerekli soruları müşteriye sorar; videolar netleşen tercihlere göre hazırlanır.
 */
export const PREPARATION_TEXT = "Üretime başlamadan önce ekibimiz gerekli soruları sorar; videolar netleşen tercihlerine göre hazırlanır.";
export const NO_REVISION_TEXT = "Paketlerde revizyon hakkı bulunmaz.";

export type MissingField = "price" | "videoCount" | "deliveryTerms" | "formats" | "styles";

export const MISSING_FIELD_LABELS: Record<MissingField, string> = {
  price: "Fiyat",
  videoCount: "Video sayısı",
  deliveryTerms: "Teslimat koşulları",
  formats: "Dahil formatlar",
  styles: "Dahil video tarzları",
};

/** Bir paketin satışa açılabilmesi için doldurulması gereken alanlar. */
export function missingSaleFields(pkg: PackageLike): MissingField[] {
  const missing: MissingField[] = [];
  if (pkg.priceKurus == null || pkg.priceKurus <= 0) missing.push("price");
  if (pkg.videoCount == null || pkg.videoCount <= 0) missing.push("videoCount");
  if (!pkg.deliveryTerms?.trim()) missing.push("deliveryTerms");
  if (pkg.includedFormats.length === 0) missing.push("formats");
  if (pkg.includedStyles.length === 0) missing.push("styles");
  return missing;
}

export type SaleContext = {
  /** Örnek (isSample) paketler satılabilir mi? Üretimde her zaman false. */
  allowSamplePackages: boolean;
  /** Yapılandırılmış ve kullanılabilir bir ödeme sağlayıcısı var mı? */
  paymentsAvailable: boolean;
};

export type SaleState =
  | { purchasable: true }
  | { purchasable: false; reason: "not_published" | "incomplete" | "sample" | "payments_unavailable" };

/**
 * Paket satın alınabilir mi? Fiyatı veya koşulları belirlenmemiş paketler asla satın alınabilir
 * gibi gösterilmez.
 */
export function saleState(pkg: PackageLike, ctx: SaleContext): SaleState {
  if (pkg.status !== "PUBLISHED") return { purchasable: false, reason: "not_published" };
  if (missingSaleFields(pkg).length > 0) return { purchasable: false, reason: "incomplete" };
  if (pkg.isSample && !ctx.allowSamplePackages) return { purchasable: false, reason: "sample" };
  if (!ctx.paymentsAvailable) return { purchasable: false, reason: "payments_unavailable" };
  return { purchasable: true };
}

/** Teslim edilecek toplam video (bonus dahil). Video sayısı belirlenmemişse null. */
export function totalVideoCount(pkg: Pick<PackageLike, "videoCount" | "bonusVideoCount">): number | null {
  if (pkg.videoCount == null) return null;
  return pkg.videoCount + Math.max(0, pkg.bonusVideoCount ?? 0);
}

/** "90 video + 15 bonus video" / "30 video" */
export function videoCountLabel(videoCount: number, bonusVideoCount = 0) {
  return bonusVideoCount > 0 ? `${videoCount} video + ${bonusVideoCount} bonus video` : `${videoCount} video`;
}

/**
 * Video başına maliyet (kuruş, en yakın kuruşa yuvarlanır). Bonus videolar dahil edilir:
 * müşterinin teslim alacağı her video için fiilen ödediği tutar.
 */
export function perVideoKurus(pkg: Pick<PackageLike, "priceKurus" | "videoCount" | "bonusVideoCount">): number | null {
  const total = totalVideoCount(pkg);
  if (!pkg.priceKurus || !total) return null;
  return Math.round(pkg.priceKurus / total);
}

export function perMonthKurus(pkg: Pick<PackageLike, "priceKurus" | "durationMonths">): number | null {
  if (!pkg.priceKurus || !pkg.durationMonths) return null;
  return Math.round(pkg.priceKurus / pkg.durationMonths);
}

export type PackageComparison = {
  packageId: string;
  perVideoKurus: number | null;
  /** Referans pakete (en kısa süreli, fiyatı belli paket) göre video başına tasarruf yüzdesi. */
  savingsPercent: number | null;
  isBaseline: boolean;
};

/**
 * Paketler arası değer karşılaştırması. Tasarruf yalnızca gerçek fiyatlardan hesaplanır;
 * fiyatı olmayan paketler için tasarruf gösterilmez, negatif ya da sıfır tasarruf gösterilmez.
 */
export function comparePackages(pkgs: PackageLike[]): PackageComparison[] {
  const priced = pkgs
    .filter((p) => perVideoKurus(p) !== null)
    .sort((a, b) => a.durationMonths - b.durationMonths);
  const baseline = priced[0];
  const basePerVideo = baseline ? perVideoKurus(baseline) : null;

  return pkgs.map((p) => {
    const pv = perVideoKurus(p);
    let savingsPercent: number | null = null;
    if (pv !== null && basePerVideo && baseline && p.id !== baseline.id && p.currency === baseline.currency) {
      const pct = Math.floor((1 - pv / basePerVideo) * 100);
      savingsPercent = pct > 0 ? pct : null;
    }
    return { packageId: p.id, perVideoKurus: pv, savingsPercent, isBaseline: baseline?.id === p.id };
  });
}

/** Sipariş anında saklanan paket koşulları. Fiyat sonradan değişse de sipariş bu kopyayı kullanır. */
export type PackageSnapshot = {
  packageId: string;
  slug: string;
  name: string;
  durationMonths: number;
  priceKurus: number;
  currency: string;
  /** Pakete dahil (ücretli) video sayısı */
  videoCount: number;
  /** Bonus video sayısı (eski siparişlerde bulunmayabilir → 0) */
  bonusVideoCount?: number;
  deliveryTerms: string;
  deliveryDays: number | null;
  includedFormats: VideoFormatValue[];
  includedStyles: VideoStyleValue[];
  isSample: boolean;
  /** Eski siparişlerde bulunmayabilir → true kabul edilir */
  trialCountsTowardPackage?: boolean;
  trialConversionBusinessDays?: number | null;
};

/** Sipariş anlık görüntüsündeki teslim edilecek toplam video (bonus dahil). */
export function snapshotTotalVideos(s: Pick<PackageSnapshot, "videoCount" | "bonusVideoCount">) {
  return s.videoCount + Math.max(0, s.bonusVideoCount ?? 0);
}

export function buildSnapshot(pkg: PackageLike): PackageSnapshot {
  if (missingSaleFields(pkg).length > 0) {
    throw new Error("Paket koşulları eksik olduğu için sipariş anlık görüntüsü oluşturulamaz.");
  }
  return {
    packageId: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    durationMonths: pkg.durationMonths,
    priceKurus: pkg.priceKurus!,
    currency: pkg.currency,
    videoCount: pkg.videoCount!,
    bonusVideoCount: Math.max(0, pkg.bonusVideoCount ?? 0),
    deliveryTerms: pkg.deliveryTerms!,
    deliveryDays: pkg.deliveryDays,
    includedFormats: [...pkg.includedFormats],
    includedStyles: [...pkg.includedStyles],
    isSample: pkg.isSample,
    trialCountsTowardPackage: pkg.trialCountsTowardPackage ?? true,
    trialConversionBusinessDays: pkg.trialConversionBusinessDays ?? null,
  };
}

/** Paket süresi: başlangıçtan itibaren takvim ayı eklenir (31 Ocak + 1 ay = 28/29 Şubat). */
export function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}
