import "server-only";
import { db } from "./db";
import { storage } from "./storage";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Yarım kalan ve sahipsiz yüklemeleri temizler:
 *  - 1 günden eski PENDING/FAILED yüklemeler
 *  - 7 günden eski, hiçbir siparişe/teslime/portfolyoya bağlanmamış müşteri yüklemeleri
 *    (sihirbazda yüklenip sipariş tamamlanmayan dosyalar)
 */
export async function cleanupUploads(now = new Date()) {
  const stale = await db.uploadedFile.findMany({
    where: {
      OR: [
        { status: { in: ["PENDING", "FAILED"] }, createdAt: { lt: new Date(now.getTime() - DAY) } },
        {
          status: "UPLOADED",
          orderId: null,
          kind: { in: ["SONG_AUDIO", "LYRICS", "MUSIC_VIDEO", "IMAGE", "FOOTAGE"] },
          createdAt: { lt: new Date(now.getTime() - 7 * DAY) },
        },
      ],
      deliverable: null,
      portfolioVideos: { none: {} },
      portfolioPosters: { none: {} },
    },
    select: { id: true, storageKey: true },
    take: 1000,
  });
  let removed = 0;
  for (const f of stale) {
    await storage()
      .delete(f.storageKey)
      .catch(() => undefined);
    await db.uploadedFile.update({ where: { id: f.id }, data: { status: "DELETED", deletedAt: now } });
    removed++;
  }
  return { removed };
}

/** Süresi dolmuş oturum ve şifre sıfırlama kayıtlarını siler. */
export async function cleanupSessions(now = new Date()) {
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const resets = await db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
  return { sessions: sessions.count, resets: resets.count };
}
