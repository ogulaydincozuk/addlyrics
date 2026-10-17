import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isTikTokShortLink, parseTikTokUrl, type EmbedInfo } from "@/lib/embeds";
import { DomainError } from "./domain/errors";

/**
 * Admin'in yapıştırdığı TikTok bağlantısını (kısa veya tam) video kimliğine çözer.
 * Kısa bağlantılar için yalnızca yönlendirme başlığı okunur; içerik indirilmez.
 */
export async function resolveTikTokUrl(input: string): Promise<EmbedInfo> {
  const url = input.trim();
  const direct = parseTikTokUrl(url);
  if (direct) return direct;
  if (!isTikTokShortLink(url)) {
    throw new DomainError("Geçerli bir TikTok video bağlantısı gir (tiktok.com/@kullanici/video/… veya vt.tiktok.com/…).");
  }
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AddLyricsBot/1.0)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const location = res.headers.get("location");
    if (!location) break;
    current = new URL(location, current).toString();
    const parsed = parseTikTokUrl(current);
    if (parsed) return parsed;
  }
  throw new DomainError("TikTok bağlantısı çözümlenemedi. Videonun tam adresini (tiktok.com/@…/video/…) yapıştırmayı dene.");
}

/**
 * TikTok oEmbed ile kapak görseli adresi. TikTok bu adresleri süreli imzalar ve istek sınırı
 * uygular; bu yüzden sonuç saatlik önbelleğe alınır ve hata durumunda null döner (kart sade
 * bir kapakla gösterilir).
 */
export async function getTikTokThumbnail(sourceUrl: string): Promise<string | null> {
  "use cache";
  cacheTag("portfolio");
  cacheLife("hours");
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(sourceUrl)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: unknown };
    return typeof data.thumbnail_url === "string" && data.thumbnail_url.startsWith("https://") ? data.thumbnail_url : null;
  } catch {
    return null;
  }
}
