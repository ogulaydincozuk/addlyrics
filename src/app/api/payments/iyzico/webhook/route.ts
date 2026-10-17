import { iyzicoConfigured } from "@/server/env";
import { jsonError } from "@/server/http";
import { verifyIyzicoWebhookSignature } from "@/server/payments/iyzico";
import { completeWebhookEvent, confirmByToken, recordWebhookEvent } from "@/server/payments/service";
import { rateLimitRequest } from "@/server/rate-limit";

/**
 * iyzico ödeme bildirimi (webhook). İmza (X-IYZ-SIGNATURE-V3) doğrulanır, aynı olay tekrar
 * işlenmez ve sonuç yine iyzico API'sinden sorgulanarak işlenir.
 */
export async function POST(request: Request) {
  if (!iyzicoConfigured()) return jsonError(404, "iyzico yapılandırılmadı.");
  if (!rateLimitRequest(request, "webhook", "iyzico").ok) return jsonError(429, "Çok fazla istek.");

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.token !== "string") return jsonError(400, "Geçersiz bildirim.");

  if (!verifyIyzicoWebhookSignature(body, request.headers.get("x-iyz-signature-v3"))) {
    console.warn("[iyzico:webhook] imza doğrulanamadı");
    return jsonError(401, "İmza geçersiz.");
  }

  const key = [body.iyziEventType, body.iyziPaymentId, body.token, body.status].map((v) => String(v ?? "")).join(":");
  const event = await recordWebhookEvent("IYZICO", key, String(body.iyziEventType ?? ""), body);
  if (!event.isNew) return Response.json({ ok: true, duplicate: true });

  try {
    await confirmByToken("IYZICO", body.token);
    await completeWebhookEvent(event.id!);
    return Response.json({ ok: true });
  } catch (err) {
    await completeWebhookEvent(event.id!, (err as Error).message);
    console.error("[iyzico:webhook]", err);
    // 5xx: iyzico bildirimi daha sonra tekrar gönderir
    return jsonError(500, "İşlenemedi.");
  }
}
