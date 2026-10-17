import { getSessionUser } from "@/server/auth/session";
import { isDomainError } from "@/server/domain/errors";
import { completeUpload } from "@/server/domain/uploads";
import { isSameOrigin, jsonError, jsonOk } from "@/server/http";

export async function POST(request: Request, ctx: RouteContext<"/api/uploads/[id]/complete">) {
  const { id } = await ctx.params;
  if (!isSameOrigin(request)) return jsonError(403, "Geçersiz istek kaynağı.");
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Oturumun sona ermiş.");
  try {
    const file = await completeUpload(user, id);
    return jsonOk({ file });
  } catch (err) {
    if (isDomainError(err)) return jsonError(err.code === "NOT_FOUND" ? 404 : 422, err.message);
    console.error("[uploads:complete]", err);
    return jsonError(500, "Yükleme doğrulanamadı.");
  }
}
