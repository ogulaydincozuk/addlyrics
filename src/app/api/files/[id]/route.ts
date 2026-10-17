import { getSessionUser } from "@/server/auth/session";
import { canAccessFile } from "@/server/domain/uploads";
import { jsonError } from "@/server/http";
import { storage } from "@/server/storage";

/**
 * Yetki kontrollü dosya indirme / oynatma.
 * ?inline=1 → tarayıcıda oynatma (video/ses), aksi halde indirme.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Giriş yapmalısın.");

  const file = await canAccessFile(user, id);
  // Yetkisiz erişimde dosyanın varlığı da gizlenir
  if (!file) return jsonError(404, "Dosya bulunamadı.");

  const inline = new URL(request.url).searchParams.get("inline") === "1";
  return storage().downloadResponse(file.storageKey, {
    fileName: file.originalName,
    contentType: file.mimeType,
    inline,
    rangeHeader: request.headers.get("range"),
  });
}
