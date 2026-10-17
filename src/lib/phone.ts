// Telefon numarası normalizasyonu (E.164). İstemci tarafında yalnızca ön kontrol içindir;
// asıl doğrulama ve hesap sınırı sunucuda uygulanır.

export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string };

/**
 * Türkiye numaraları ülke kodu olmadan da yazılabilir (0532…, 532…, +90 532…).
 * Diğer ülkeler "+" ve ülke koduyla yazılmalıdır.
 */
export function normalizePhone(input: string): PhoneResult {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: false, error: "Telefon numaranı yaz." };
  if (/[^\d\s()+.\-]/.test(raw)) return { ok: false, error: "Telefon numarası yalnızca rakam içermeli." };

  const hasPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!hasPlus && digits.startsWith("00")) digits = digits.slice(2);
  else if (!hasPlus) {
    // Türkiye yerel yazımı
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10) digits = `90${digits}`;
  }

  if (digits.startsWith("90")) {
    const national = digits.slice(2);
    // Türkiye: 10 hane; cep telefonları 5 ile başlar
    if (national.length !== 10) return { ok: false, error: "Türkiye numarası 10 haneli olmalı (5xx xxx xx xx)." };
    if (!national.startsWith("5")) return { ok: false, error: "Doğrulama için cep telefonu numarası gir (5 ile başlar)." };
    return { ok: true, e164: `+90${national}` };
  }

  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
    return { ok: false, error: "Numarayı ülke koduyla yaz (ör. +49 1512 3456789)." };
  }
  return { ok: true, e164: `+${digits}` };
}

/** Ekranda gösterim: +90 532 *** ** 67 */
export function maskPhone(e164: string | null | undefined) {
  if (!e164) return "";
  if (e164.startsWith("+90") && e164.length === 13) {
    const n = e164.slice(3);
    return `+90 ${n.slice(0, 3)} *** ** ${n.slice(8)}`;
  }
  return `${e164.slice(0, 4)}${"*".repeat(Math.max(0, e164.length - 6))}${e164.slice(-2)}`;
}

export function formatPhone(e164: string | null | undefined) {
  if (!e164) return "";
  if (e164.startsWith("+90") && e164.length === 13) {
    const n = e164.slice(3);
    return `+90 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8)}`;
  }
  return e164;
}

/** Telefon başına izin verilen doğrulanmış hesap sayısı (veritabanı CHECK kısıtıyla aynı). */
export const MAX_ACCOUNTS_PER_PHONE = 2;
