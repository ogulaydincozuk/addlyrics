// Tarihler her zaman Türkiye saatine göre gösterilir.
const TZ = "Europe/Istanbul";

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
}

export function formatDateShort(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** <input type="date"> değeri (YYYY-MM-DD) */
export function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts;
}

/** YYYY-MM-DD → Türkiye saatiyle gün sonu (23:59) */
export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T23:59:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysUntil(d: Date, now = new Date()) {
  return Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
