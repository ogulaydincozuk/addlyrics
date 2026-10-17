import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { jsonError } from "@/server/http";
import { verifyTrialMediaToken, type TrialMediaKind } from "@/server/media-sign";
import { storage } from "@/server/storage";

/**
 * Deneme ön izlemesi / kapak görseli. Yalnızca süreli imzalı bağlantıyla ve yalnızca başvuru sahibine sunulur.
 * Temiz ana dosya bu rotadan asla sunulmaz.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/deneme-medya/[id]/[kind]">) {
  const { id, kind } = await ctx.params;
  if (kind !== "preview" && kind !== "poster") return jsonError(404, "Bulunamadı.");
  const mediaKind = kind as TrialMediaKind;

  const user = await getSessionUser();
  if (!user) return jsonError(401, "Giriş yapmalısın.");

  const token = new URL(request.url).searchParams.get("t");
  const signed = verifyTrialMediaToken(token, id, mediaKind);
  // Yönetici kalite kontrol için imzasız da izleyebilir
  if (user.role !== "ADMIN" && (!signed || signed.userId !== user.id)) return jsonError(404, "Bulunamadı.");

  const video = await db.trialVideo.findUnique({
    where: { id },
    include: {
      trial: { select: { userId: true, status: true, purgedAt: true } },
      previewFile: true,
      posterFile: true,
    },
  });
  if (!video || video.trial.purgedAt) return jsonError(404, "Bulunamadı.");
  if (user.role !== "ADMIN") {
    if (video.trial.userId !== user.id) return jsonError(404, "Bulunamadı.");
    // Kalite kontrolden geçmemiş ön izleme müşteriye gösterilmez
    if (video.status !== "PREVIEW_READY" && video.status !== "COMPLETED") return jsonError(404, "Bulunamadı.");
  }
  const file = mediaKind === "preview" ? video.previewFile : video.posterFile;
  if (!file || file.status !== "UPLOADED") return jsonError(404, "Bulunamadı.");

  const response = await storage().downloadResponse(file.storageKey, {
    fileName: file.originalName,
    contentType: file.mimeType,
    inline: true,
    rangeHeader: request.headers.get("range"),
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}
