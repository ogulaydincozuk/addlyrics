import { safeEqual } from "@/server/crypto";
import { checkTrialDelays, purgeExpiredTrials } from "@/server/domain/trials";
import { jsonError } from "@/server/http";
import { cleanupSessions, cleanupUploads } from "@/server/maintenance";

/**
 * Zamanlanmış bakım (Vercel Cron — vercel.json). `npm run maintenance` ile aynı işleri yapar.
 * Vercel, CRON_SECRET tanımlıysa isteğe "Authorization: Bearer <CRON_SECRET>" ekler; başka çağrılar reddedilir.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) return jsonError(401, "Yetkisiz.");

  const uploads = await cleanupUploads();
  const sessions = await cleanupSessions();
  const delayedTrials = await checkTrialDelays();
  const purgedTrials = await purgeExpiredTrials();
  return Response.json({
    ok: true,
    removedUploads: uploads.removed,
    expiredSessions: sessions.sessions,
    expiredResetLinks: sessions.resets,
    delayedTrials,
    purgedTrials,
  });
}
