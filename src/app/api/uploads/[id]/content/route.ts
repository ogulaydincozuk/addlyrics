import { verifyToken } from "@/server/crypto";
import { db } from "@/server/db";
import { isSameOrigin, jsonError, jsonOk } from "@/server/http";
import { storage } from "@/server/storage";
import { LocalStorageDriver } from "@/server/storage/local";

/**
 * Yerel depolama sürücüsü için yükleme uç noktası (S3 kullanılırken çağrılmaz).
 * Yetki, başlatma sırasında üretilen kısa ömürlü imzalı belirteçle sağlanır.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/uploads/[id]/content">) {
  const { id } = await ctx.params;
  if (!isSameOrigin(request)) return jsonError(403, "Geçersiz istek kaynağı.");
  const driver = storage();
  if (!(driver instanceof LocalStorageDriver)) return jsonError(404, "Bulunamadı.");

  const token = request.headers.get("x-upload-token");
  const claims = verifyToken<{ fid: string; key: string; size: number }>(token);
  if (!claims || claims.fid !== id) return jsonError(403, "Yükleme izni geçersiz veya süresi dolmuş.");

  const file = await db.uploadedFile.findUnique({ where: { id }, select: { status: true, storageKey: true, sizeBytes: true } });
  if (!file || file.status !== "PENDING" || file.storageKey !== claims.key) return jsonError(409, "Bu yükleme artık geçerli değil.");
  if (!request.body) return jsonError(400, "Dosya içeriği boş.");

  const expected = Number(file.sizeBytes);
  const declared = Number(request.headers.get("content-length") ?? expected);
  if (declared > expected) return jsonError(413, "Dosya beyan edilen boyuttan büyük.");

  try {
    const written = await driver.writeStream(file.storageKey, request.body, expected);
    if (written !== expected) {
      await driver.delete(file.storageKey);
      return jsonError(400, "Dosya eksik yüklendi. Lütfen tekrar dene.");
    }
    return jsonOk();
  } catch (err) {
    if ((err as Error).message === "SIZE_LIMIT") return jsonError(413, "Dosya beyan edilen boyuttan büyük.");
    console.error("[uploads:content]", err);
    return jsonError(500, "Dosya kaydedilemedi.");
  }
}
