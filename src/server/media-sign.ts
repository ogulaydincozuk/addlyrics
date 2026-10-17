import "server-only";
import { signToken, verifyToken } from "./crypto";

export type TrialMediaKind = "preview" | "poster";

/** Ön izleme bağlantılarının geçerlilik süresi. Sayfa her açıldığında yenisi üretilir. */
export const TRIAL_MEDIA_TTL_SECONDS = 20 * 60;

/**
 * Deneme ön izlemesi için süreli, imzalı bağlantı. Belirteç video, kullanıcı ve dosya türüne bağlıdır;
 * sunucu ayrıca oturumdaki kullanıcının belirteçteki kullanıcıyla aynı olduğunu kontrol eder.
 */
export function signTrialMediaUrl(videoId: string, userId: string, kind: TrialMediaKind) {
  const token = signToken({ v: videoId, u: userId, k: kind }, TRIAL_MEDIA_TTL_SECONDS);
  return `/api/deneme-medya/${videoId}/${kind}?t=${encodeURIComponent(token)}`;
}

export function verifyTrialMediaToken(token: string | null, videoId: string, kind: TrialMediaKind) {
  const data = verifyToken<{ v: string; u: string; k: string }>(token);
  if (!data || data.v !== videoId || data.k !== kind) return null;
  return { userId: data.u };
}
