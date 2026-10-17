import "server-only";
import { db } from "../db";
import { signTrialMediaUrl } from "../media-sign";

/** Müşterinin kendi denemesi. Ön izleme bağlantıları yalnızca bu kullanıcı için ve süreli imzalanır. */
export async function getCustomerTrial(userId: string) {
  const trial = await db.trialApplication.findUnique({
    where: { userId },
    include: {
      song: { select: { artistName: true, title: true, lyrics: true } },
      videos: { orderBy: { sequence: "asc" } },
      files: { where: { status: "UPLOADED", kind: { in: ["SONG_AUDIO", "LYRICS", "MUSIC_VIDEO", "IMAGE", "FOOTAGE"] } }, orderBy: { createdAt: "asc" } },
      events: { where: { visibleToCustomer: true }, orderBy: { createdAt: "desc" }, take: 30 },
      convertedOrder: { select: { number: true, status: true } },
      purchaseOrders: { where: { status: "PAYMENT_PENDING" }, select: { number: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!trial) return null;
  const visible = (s: string) => s === "PREVIEW_READY" || s === "COMPLETED";
  return {
    ...trial,
    videos: trial.videos.map((v) => ({
      id: v.id,
      sequence: v.sequence,
      style: v.style,
      approach: v.approach,
      status: v.status,
      previewReadyAt: v.previewReadyAt,
      previewSeconds: v.previewSeconds,
      watermarked: v.watermarked,
      previewUrl: visible(v.status) && v.previewFileId && !trial.purgedAt ? signTrialMediaUrl(v.id, userId, "preview") : null,
      posterUrl: visible(v.status) && v.posterFileId && !trial.purgedAt ? signTrialMediaUrl(v.id, userId, "poster") : null,
    })),
  };
}

export type CustomerTrial = NonNullable<Awaited<ReturnType<typeof getCustomerTrial>>>;
