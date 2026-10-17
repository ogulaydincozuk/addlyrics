// Aylık teslim planı — saf fonksiyonlar (istemci ve sunucuda kullanılabilir, testleri tests/delivery-plan.test.ts).
//
// İş kuralı (AddLyrics): Paketler paket süresi boyunca aylık olarak teslim edilir.
//   1 aylık  → 30 video
//   2 aylık  → 30 + 30
//   3 aylık  → 30 + 30 + 45 (15 bonus video son ay teslim edilir)
// İlk teslim (Türkiye saatiyle ödeme günü):
//   - Ayın 1–15'i arasında → ödemeden itibaren 5 iş günü içinde; sonraki teslimler izleyen ayların 1'inde.
//   - Ayın 16'sı ve sonrası → izleyen ayın 1'inde; sonraki teslimler de her ayın 1'inde.
// Kural yalnızca `deliveryDates` fonksiyonunda tanımlıdır.

const TR_OFFSET_MS = 3 * 60 * 60 * 1000; // Türkiye saati (UTC+3, yaz saati uygulaması yok)

/** İlk teslimin 5 iş günü içinde yapıldığı ay günleri (dahil). */
export const EARLY_PURCHASE_LAST_DAY = 15;
export const FIRST_DELIVERY_BUSINESS_DAYS = 5;

/**
 * Sabit tarihli resmî tatiller (ay-gün). Dini bayramlar (Ramazan/Kurban) her yıl değiştiği için
 * listede yoktur; o dönemlerde teslim tarihi gerekirse yönetim panelinden elle güncellenir.
 */
const FIXED_HOLIDAYS = new Set(["01-01", "04-23", "05-01", "05-19", "07-15", "08-30", "10-29"]);

function trParts(date: Date) {
  const tr = new Date(date.getTime() + TR_OFFSET_MS);
  return { y: tr.getUTCFullYear(), m: tr.getUTCMonth(), d: tr.getUTCDate() };
}

/** Türkiye takviminde gün (12:00) */
function trNoon(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d, 9, 0, 0));
}

export function isBusinessDay(date: Date) {
  const { y, m, d } = trParts(date);
  const weekday = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0 pazar, 6 cumartesi
  if (weekday === 0 || weekday === 6) return false;
  return !FIXED_HOLIDAYS.has(`${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
}

/** Ödeme gününden sonraki n. iş günü (Türkiye saatiyle 12:00). */
export function addBusinessDays(start: Date, businessDays: number) {
  const { y, m, d } = trParts(start);
  let cursor = trNoon(y, m, d);
  let counted = 0;
  while (counted < businessDays) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    if (isBusinessDay(cursor)) counted++;
  }
  return cursor;
}

/** Video sayısını aylara böler; bonus videolar son aya eklenir. 90 + 15 bonus, 3 ay → [30, 30, 45] */
export function monthlyAllocation(videoCount: number, bonusVideoCount: number, months: number): number[] {
  if (months <= 0 || videoCount <= 0) return [];
  const base = Math.floor(videoCount / months);
  const remainder = videoCount - base * months;
  return Array.from({ length: months }, (_, i) => {
    let n = base + (i >= months - remainder ? 1 : 0); // artan videolar son aylara
    if (i === months - 1) n += Math.max(0, bonusVideoCount);
    return n;
  });
}

/**
 * Teslim tarihleri (Türkiye saatiyle 12:00).
 * Ayın 1–15'i arasındaki ödemelerde ilk teslim 5 iş günü içinde, sonrakiler izleyen ayların 1'inde;
 * 16'sı ve sonrasındaki ödemelerde tüm teslimler izleyen ayların 1'inde.
 */
export function deliveryDates(start: Date, months: number): Date[] {
  const { y, m, d } = trParts(start);
  if (d <= EARLY_PURCHASE_LAST_DAY) {
    return Array.from({ length: months }, (_, i) => (i === 0 ? addBusinessDays(start, FIRST_DELIVERY_BUSINESS_DAYS) : trNoon(y, m + i, 1)));
  }
  return Array.from({ length: months }, (_, i) => trNoon(y, m + 1 + i, 1));
}

export type DeliveryBatch = { month: number; date: Date; videos: number; bonus: number; fromIndex: number; toIndex: number };

export function deliverySchedule(start: Date, videoCount: number, bonusVideoCount: number, months: number): DeliveryBatch[] {
  const allocation = monthlyAllocation(videoCount, bonusVideoCount, months);
  const dates = deliveryDates(start, months);
  let cursor = 0;
  return allocation.map((videos, i) => {
    const batch: DeliveryBatch = {
      month: i + 1,
      date: dates[i]!,
      videos,
      bonus: i === months - 1 ? Math.max(0, bonusVideoCount) : 0,
      fromIndex: cursor,
      toIndex: cursor + videos - 1,
    };
    cursor += videos;
    return batch;
  });
}

/** Paket içindeki n. videonun (0'dan başlar) planlanan teslim tarihi. Plan dışındaysa son teslim tarihi. */
export function batchDateForIndex(schedule: DeliveryBatch[], index: number): Date | null {
  if (!schedule.length) return null;
  return (schedule.find((b) => index >= b.fromIndex && index <= b.toIndex) ?? schedule.at(-1)!).date;
}

/** "30 / 30 / 45" */
export function allocationLabel(videoCount: number, bonusVideoCount: number, months: number) {
  return monthlyAllocation(videoCount, bonusVideoCount, months).join(" / ");
}

/** İlk teslim kuralının kısa açıklaması (paket kartları, sipariş özeti ve SSS için). */
export const FIRST_DELIVERY_RULE_TEXT = `Ayın 1–${EARLY_PURCHASE_LAST_DAY}'i arasındaki alımlarda ilk teslim ${FIRST_DELIVERY_BUSINESS_DAYS} iş günü içinde, ${EARLY_PURCHASE_LAST_DAY + 1}'sından sonraki alımlarda izleyen ayın 1'inde yapılır.`;

/** Pakete göre okunur teslim planı açıklaması. */
export function describeDeliveryPlan(videoCount: number, bonusVideoCount: number, months: number) {
  const alloc = monthlyAllocation(videoCount, bonusVideoCount, months);
  if (!alloc.length) return "";
  if (months === 1) return `${alloc[0]} video tek seferde teslim edilir. ${FIRST_DELIVERY_RULE_TEXT}`;
  const parts = alloc.map((n, i) => `${i + 1}. teslim ${n}`).join(", ");
  return `${parts} video${bonusVideoCount > 0 ? ` (${bonusVideoCount} bonus dahil)` : ""}. ${FIRST_DELIVERY_RULE_TEXT} Sonraki teslimler her ayın 1'inde.`;
}
