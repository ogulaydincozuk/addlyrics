// Harici video gömme yardımcıları (istemci ve sunucuda kullanılabilir).
// Videolar yeniden barındırılmaz; platformun resmî gömülü oynatıcısı kullanılır.

export type EmbedInfo = { provider: "tiktok"; id: string; handle: string | null; sourceUrl: string };

const TIKTOK_VIDEO = /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([\w.-]+)\/video\/(\d{8,25})/i;

/** Tam TikTok video adresini çözümler (kısa vt.tiktok.com bağlantıları sunucuda açılır). */
export function parseTikTokUrl(url: string): EmbedInfo | null {
  const m = TIKTOK_VIDEO.exec(url.trim());
  if (!m) return null;
  const handle = m[1]!;
  const id = m[2]!;
  return { provider: "tiktok", id, handle, sourceUrl: `https://www.tiktok.com/@${handle}/video/${id}` };
}

export function isTikTokShortLink(url: string) {
  return /^https?:\/\/(?:vt|vm)\.tiktok\.com\/[\w-]+\/?$/i.test(url.trim());
}

/** TikTok Embed Player v1 — https://developers.tiktok.com/doc/embed-player */
export function tiktokPlayerUrl(id: string, opts: { autoplay?: boolean } = {}) {
  const params = new URLSearchParams({
    music_info: "1",
    description: "1",
    rel: "0",
    autoplay: opts.autoplay ? "1" : "0",
  });
  return `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?${params}`;
}
