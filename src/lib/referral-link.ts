// İş ortağı paylaşım bağlantısı (?kod=KOD): kod tarayıcıda saklanır ve sipariş özetinde otomatik doldurulur.
// İndirim ve komisyon her zaman sunucuda doğrulanır; burada yalnızca kolaylık için hatırlanır.
import { isValidReferralCode, normalizeReferralCode } from "./referral";

export const REFERRAL_QUERY_PARAM = "kod";
const STORAGE_KEY = "addlyrics:ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Paylaşım bağlantısı: paket seçimi sayfasına kodla birlikte gider. */
export function referralSharePath(code: string) {
  return `/paketler?${REFERRAL_QUERY_PARAM}=${encodeURIComponent(code)}`;
}

export function storeReferralCode(input: string): string | null {
  const code = normalizeReferralCode(input);
  if (!isValidReferralCode(code)) return null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {}
  return code;
}

/** 30 gün içinde bir paylaşım bağlantısıyla gelinmişse kodu döndürür. */
export function readStoredReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; at?: number };
    if (!parsed.code || !parsed.at || Date.now() - parsed.at > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return isValidReferralCode(parsed.code) ? parsed.code : null;
  } catch {
    return null;
  }
}
