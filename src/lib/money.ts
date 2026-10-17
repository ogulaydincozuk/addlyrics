// Para tutarları her yerde kuruş (tam sayı) olarak tutulur; ondalık hesap hatalarını önler.

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(kurus: number, currency = "TRY", opts: { compact?: boolean } = {}) {
  const key = `${currency}:${opts.compact ? 1 : 0}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: opts.compact ? 0 : 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, f);
  }
  return f.format(kurus / 100);
}

/** "1.499,90" veya "1499.90" gibi girişleri kuruşa çevirir. Geçersizse null. */
export function parseMoneyToKurus(input: string): number | null {
  const raw = input.trim().replace(/\s|₺|TL/gi, "");
  if (!raw) return null;
  let normalized = raw;
  if (raw.includes(",")) {
    // Türkçe biçim: binlik ayırıcı ".", ondalık ","
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    // "3.200" / "12.500.000" → yalnızca binlik ayırıcı
    normalized = raw.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, frac = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Kuruşu sağlayıcıların beklediği "1499.90" biçimine çevirir. */
export function kurusToDecimalString(kurus: number) {
  const sign = kurus < 0 ? "-" : "";
  const abs = Math.abs(kurus);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "1499.9" / "1499.90" / 1499.9 → 149990 kuruş */
export function decimalToKurus(value: string | number): number | null {
  const s = typeof value === "number" ? value.toFixed(2) : value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const negative = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const kurus = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  // 3. ondalık hane yuvarlaması
  const third = Number(frac[2] ?? "0");
  const rounded = third >= 5 ? kurus + 1 : kurus;
  return negative ? -rounded : rounded;
}
