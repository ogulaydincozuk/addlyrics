// Referans/indirim kodu ve komisyon hesapları (saf fonksiyonlar). Tüm tutarlar kuruş, oranlar baz puan.
// Hesaplar sunucuda yapılır; istemci yalnızca gösterir.

export type DiscountTypeValue = "PERCENT" | "FIXED";
export type CommissionBaseValue = "LIST_PRICE" | "PAID_AMOUNT" | "PAID_AMOUNT_EXCL_VAT";

export const COMMISSION_BASE_LABEL: Record<CommissionBaseValue, string> = {
  LIST_PRICE: "İndirim öncesi liste fiyatı",
  PAID_AMOUNT: "Tahsil edilen tutar (indirim sonrası, KDV dahil)",
  PAID_AMOUNT_EXCL_VAT: "Tahsil edilen tutarın KDV hariç kısmı",
};

export const COMMISSION_STATUS_LABEL = {
  PENDING: "Beklemede",
  APPROVED: "Onaylandı",
  PAID: "Ödendi",
  CANCELLED: "İptal edildi",
} as const;

/** Kodlar büyük harf, rakam, tire; 4–24 karakter. Türkçe karakterler dönüştürülür. */
export function normalizeReferralCode(input: string) {
  const map: Record<string, string> = { ç: "C", ğ: "G", ı: "I", i: "I", ö: "O", ş: "S", ü: "U", Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" };
  return String(input ?? "")
    .trim()
    .replace(/[çğıiöşüÇĞİÖŞÜ]/g, (c) => map[c] ?? c)
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isValidReferralCode(code: string) {
  return /^[A-Z0-9][A-Z0-9-]{2,22}[A-Z0-9]$/.test(code);
}

/** Minimum ödenecek tutar: indirim siparişi bedelsiz hale getiremez (1 TL). */
export const MIN_PAYABLE_KURUS = 100;

export function computeDiscount(listKurus: number, type: DiscountTypeValue, value: number) {
  if (listKurus <= 0 || value <= 0) return 0;
  const raw = type === "PERCENT" ? Math.round((listKurus * Math.min(value, 10000)) / 10000) : value;
  return Math.max(0, Math.min(raw, listKurus - MIN_PAYABLE_KURUS));
}

export type CommissionCalculation = {
  baseType: CommissionBaseValue;
  listPriceKurus: number;
  discountKurus: number;
  paidKurus: number;
  vatRatePercent: number | null;
  baseAmountKurus: number;
  rateBps: number;
  amountKurus: number;
  explanation: string;
};

export function computeCommission(input: {
  baseType: CommissionBaseValue;
  rateBps: number;
  listPriceKurus: number;
  discountKurus: number;
  paidKurus: number;
  vatRatePercent: number;
}): CommissionCalculation {
  const { baseType, rateBps, listPriceKurus, discountKurus, paidKurus, vatRatePercent } = input;
  let base: number;
  let explanation: string;
  if (baseType === "LIST_PRICE") {
    base = listPriceKurus;
    explanation = "Komisyon, indirim öncesi liste fiyatı üzerinden hesaplandı.";
  } else if (baseType === "PAID_AMOUNT") {
    base = paidKurus;
    explanation = "Komisyon, müşteriden tahsil edilen tutar (indirim sonrası, KDV dahil) üzerinden hesaplandı.";
  } else {
    base = Math.round((paidKurus * 100) / (100 + vatRatePercent));
    explanation = `Komisyon, tahsil edilen tutarın KDV hariç kısmı (KDV %${vatRatePercent}) üzerinden hesaplandı.`;
  }
  const amount = Math.floor((base * rateBps) / 10000);
  return {
    baseType,
    listPriceKurus,
    discountKurus,
    paidKurus,
    vatRatePercent: baseType === "PAID_AMOUNT_EXCL_VAT" ? vatRatePercent : null,
    baseAmountKurus: base,
    rateBps,
    amountKurus: amount,
    explanation,
  };
}

/** Baz puanı yüzde metnine çevirir: 1000 → "%10", 1250 → "%12,5" */
export function bpsLabel(bps: number) {
  const pct = bps / 100;
  return `%${pct.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}

/** "%10" / "10" / "12,5" → baz puan */
export function parsePercentToBps(input: string) {
  const cleaned = String(input ?? "").replace("%", "").replace(",", ".").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
  const bps = Math.round(Number(cleaned) * 100);
  return bps >= 0 && bps <= 10000 ? bps : null;
}

/** Kod geçerlilik durumu (sunucuda veritabanı kaydıyla birlikte değerlendirilir) */
export function codeAvailability(
  code: { active: boolean; startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; usageCount: number; partnerActive: boolean },
  now = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (!code.active || !code.partnerActive) return { ok: false, reason: "Bu kod artık geçerli değil." };
  if (code.startsAt && code.startsAt > now) return { ok: false, reason: "Bu kod henüz kullanıma açılmadı." };
  if (code.endsAt && code.endsAt <= now) return { ok: false, reason: "Bu kodun süresi dolmuş." };
  if (code.usageLimit != null && code.usageCount >= code.usageLimit) return { ok: false, reason: "Bu kodun kullanım limiti dolmuş." };
  return { ok: true };
}

/** İş ortağı panelinde müşteri adını maskeler: "Ayşe Yılmaz" → "A*** Y***" */
export function maskName(name: string | null | undefined) {
  return String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0]!.toLocaleUpperCase("tr-TR")}***`)
    .join(" ");
}
