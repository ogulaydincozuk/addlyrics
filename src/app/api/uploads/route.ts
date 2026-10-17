import { z } from "zod";
import { FILE_KINDS } from "@/lib/enums";
import { getSessionUser } from "@/server/auth/session";
import { isDomainError } from "@/server/domain/errors";
import { initUpload } from "@/server/domain/uploads";
import { isSameOrigin, jsonError, jsonOk } from "@/server/http";
import { rateLimitRequest } from "@/server/rate-limit";

const bodySchema = z.object({
  kind: z.enum(FILE_KINDS),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mimeType: z.string().max(150).default(""),
  orderId: z.string().max(40).nullish(),
  trialId: z.string().max(40).nullish(),
});

/** Yükleme başlatma: dosya kaydı oluşturur ve imzalı yükleme hedefi döndürür. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Geçersiz istek kaynağı.");
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Oturumun sona ermiş. Lütfen tekrar giriş yap.");

  const limit = rateLimitRequest(request, "uploadInit", user.id);
  if (!limit.ok) return jsonError(429, "Çok fazla yükleme isteği. Lütfen biraz bekle.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Geçersiz yükleme isteği.");

  try {
    const result = await initUpload(user, parsed.data);
    return jsonOk(result);
  } catch (err) {
    if (isDomainError(err)) return jsonError(err.code === "FORBIDDEN" ? 403 : 400, err.message);
    console.error("[uploads:init]", err);
    return jsonError(500, "Yükleme başlatılamadı.");
  }
}
