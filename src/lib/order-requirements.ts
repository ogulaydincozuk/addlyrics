// Bir siparişin üretime başlayabilmesi için gereken dosyalar — saf fonksiyon.
import type { CustomerFileKind, FootageSourceValue, VideoStyleValue } from "./enums";

export type RequiredItem = "SONG_AUDIO" | "LYRICS" | "MUSIC_VIDEO" | "FOOTAGE";

export const REQUIRED_ITEM_LABELS: Record<RequiredItem, string> = {
  SONG_AUDIO: "Şarkı dosyası (WAV veya MP3)",
  LYRICS: "Şarkı sözleri (metin veya dosya)",
  MUSIC_VIDEO: "Müzik klibi (MP4 veya MOV)",
  FOOTAGE: "Kullanılacak görüntüler (MP4 veya MOV)",
};

export function missingRequiredItems(input: {
  style: VideoStyleValue;
  footageSource: FootageSourceValue | null | undefined;
  lyricsText: string | null | undefined;
  fileKinds: CustomerFileKind[] | string[];
}): RequiredItem[] {
  const kinds = new Set(input.fileKinds);
  const missing: RequiredItem[] = [];
  if (!kinds.has("SONG_AUDIO")) missing.push("SONG_AUDIO");
  if (!input.lyricsText?.trim() && !kinds.has("LYRICS")) missing.push("LYRICS");
  if (input.style === "MUSIC_VIDEO" && !kinds.has("MUSIC_VIDEO")) missing.push("MUSIC_VIDEO");
  if (input.style === "FILM_EDIT" && input.footageSource === "CUSTOMER_PROVIDED" && !kinds.has("FOOTAGE")) {
    missing.push("FOOTAGE");
  }
  return missing;
}
