import { getSessionUser } from "@/server/auth/session";
import { isDomainError } from "@/server/domain/errors";
import { deleteUpload } from "@/server/domain/uploads";
import { isSameOrigin, jsonError, jsonOk } from "@/server/http";

export async function DELETE(request: Request, ctx: RouteContext<"/api/uploads/[id]">) {
  const { id } = await ctx.params;
  if (!isSameOrigin(request)) return jsonError(403, "Geçersiz istek kaynağı.");
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Oturumun sona ermiş.");
  try {
    await deleteUpload(user, id);
    return jsonOk();
  } catch (err) {
    if (isDomainError(err)) return jsonError(err.code === "NOT_FOUND" ? 404 : 400, err.message);
    console.error("[uploads:delete]", err);
    return jsonError(500, "Dosya silinemedi.");
  }
}
