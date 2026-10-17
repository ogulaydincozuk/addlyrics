import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { jsonError } from "@/server/http";
import { storage } from "@/server/storage";

/**
 * Portfolyo medyası. Yalnızca yayındaki bir portfolyo öğesine bağlı dosyalar herkese açıktır;
 * müşteri dosyaları bu rotadan asla sunulmaz.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  const file = await db.uploadedFile.findFirst({
    where: { id, status: "UPLOADED", kind: { in: ["PORTFOLIO_VIDEO", "PORTFOLIO_POSTER"] } },
    include: {
      portfolioVideos: { select: { published: true } },
      portfolioPosters: { select: { published: true } },
    },
  });
  if (!file) return jsonError(404, "Bulunamadı.");

  const isPublic = [...file.portfolioVideos, ...file.portfolioPosters].some((p) => p.published);
  if (!isPublic) {
    const user = await getSessionUser();
    if (user?.role !== "ADMIN") return jsonError(404, "Bulunamadı.");
  }

  const response = await storage().downloadResponse(file.storageKey, {
    fileName: file.originalName,
    contentType: file.mimeType,
    inline: true,
    rangeHeader: request.headers.get("range"),
  });
  if (isPublic && response.status < 300) response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
