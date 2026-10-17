import "server-only";
import { db } from "../db";

/**
 * Müşteri veri erişim katmanı. Her sorgu oturumdaki kullanıcının kimliğiyle sınırlandırılır;
 * bir müşteri başka bir müşterinin kayıtlarına bu fonksiyonlarla erişemez.
 */

export async function getEntitlements(userId: string) {
  return db.packageEntitlement.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      package: { select: { name: true } },
      sourceOrder: { select: { number: true, packageSnapshot: true } },
      _count: { select: { orders: true } },
    },
  });
}

export async function getOrders(userId: string) {
  return db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      song: { select: { artistName: true, title: true } },
      _count: { select: { deliverables: { where: { releasedAt: { not: null } } } } },
    },
  });
}

export async function getOrderDetail(userId: string, number: string) {
  return db.order.findFirst({
    where: { number, userId },
    include: {
      song: true,
      entitlement: { select: { id: true, totalVideos: true, usedVideos: true, endsAt: true, status: true } },
      files: { where: { status: "UPLOADED", kind: { not: "DELIVERABLE" } }, orderBy: { createdAt: "asc" } },
      projects: {
        orderBy: { sequence: "asc" },
        include: {
          // Müşteri yalnızca yayınlanmış teslimleri görür
          deliverables: {
            where: { releasedAt: { not: null } },
            orderBy: { version: "desc" },
            include: { file: { select: { id: true, originalName: true, sizeBytes: true } } },
          },
        },
      },
      events: { where: { visibleToCustomer: true }, orderBy: { createdAt: "desc" }, take: 50 },
      payments: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
}

export async function getSongs(userId: string) {
  return db.song.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { orders: { select: { number: true, status: true, videoCount: true }, orderBy: { createdAt: "desc" } } },
  });
}

export async function getFiles(userId: string) {
  return db.uploadedFile.findMany({
    where: { ownerId: userId, status: "UPLOADED", kind: { in: ["SONG_AUDIO", "LYRICS", "MUSIC_VIDEO", "IMAGE", "FOOTAGE"] } },
    orderBy: { createdAt: "desc" },
    include: { order: { select: { number: true, status: true } } },
  });
}

export async function getDeliveries(userId: string) {
  return db.deliverable.findMany({
    where: { releasedAt: { not: null }, order: { userId } },
    orderBy: { releasedAt: "desc" },
    include: {
      file: { select: { id: true, originalName: true, sizeBytes: true } },
      project: { select: { title: true, format: true } },
      order: { select: { number: true, song: { select: { artistName: true, title: true } } } },
    },
  });
}

export async function getPayments(userId: string) {
  return db.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { order: { select: { number: true, packageSnapshot: true } } },
  });
}

export async function getNotifications(userId: string, take = 8) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, include: { order: { select: { number: true } } } });
}

/** Müşteri bildirimleri (yönetici uyarıları yönetim panelinde izlenir, burada sayılmaz). */
export function countUnreadNotifications(userId: string) {
  return db.notification.count({ where: { userId, readAt: null, type: { not: "ADMIN_ALERT" } } });
}

/**
 * Müşterinin ilgisini bekleyenler: ekibin yanıt bekleyen soruları (siparişteki son mesaj ekipten),
 * okunmamış bildirimler, hesap doğrulaması ve deneme durumu. Panel menüsü ve genel bakış kullanır.
 */
export async function getPanelAttention(userId: string) {
  const [latest, unreadNotifications, user, trial] = await Promise.all([
    db.$queryRaw<Array<{ orderId: string; type: string; message: string | null; createdAt: Date }>>`
      SELECT DISTINCT ON (e."orderId") e."orderId", e."type", e."message", e."createdAt"
      FROM "OrderEvent" e
      JOIN "Order" o ON o."id" = e."orderId"
      WHERE o."userId" = ${userId} AND o."status" <> 'CANCELLED' AND e."type" IN ('CUSTOMER_MESSAGE', 'NOTE')
      ORDER BY e."orderId", e."createdAt" DESC`,
    countUnreadNotifications(userId),
    db.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true, phoneVerifiedAt: true } }),
    db.trialApplication.findUnique({ where: { userId }, select: { number: true, status: true } }),
  ]);
  const waiting = latest.filter((l) => l.type === "NOTE");
  const orders = waiting.length
    ? await db.order.findMany({
        where: { id: { in: waiting.map((w) => w.orderId) }, userId },
        select: { id: true, number: true, song: { select: { artistName: true, title: true } } },
      })
    : [];
  const awaitingReply = waiting
    .flatMap((w) => {
      const o = orders.find((x) => x.id === w.orderId);
      return o ? [{ number: o.number, song: `${o.song.artistName} – ${o.song.title}`, question: w.message ?? "", at: w.createdAt }] : [];
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  return {
    awaitingReply,
    unreadNotifications,
    emailVerified: Boolean(user?.emailVerifiedAt),
    phoneVerified: Boolean(user?.phoneVerifiedAt),
    trial,
  };
}
