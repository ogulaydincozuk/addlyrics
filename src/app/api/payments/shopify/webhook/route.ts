import { env, shopifyWebhooksConfigured } from "@/server/env";
import { jsonError } from "@/server/http";
import { parseShopifyOrderPayload, verifyShopifyWebhook } from "@/server/payments/shopify";
import { processShopifyPaidOrder, processShopifyRefundOrCancel } from "@/server/payments/shopify-sync";
import { completeWebhookEvent, recordWebhookEvent } from "@/server/payments/service";
import { rateLimitRequest } from "@/server/rate-limit";

/**
 * Shopify webhook'ları: orders/paid, refunds/create, orders/cancelled.
 * Shopify yapılandırılmamışsa 404 döner — bağlantı varmış gibi davranılmaz.
 */
export async function POST(request: Request) {
  if (!shopifyWebhooksConfigured()) return jsonError(404, "Shopify entegrasyonu yapılandırılmadı.");
  if (!rateLimitRequest(request, "webhook", "shopify").ok) return jsonError(429, "Çok fazla istek.");

  const raw = await request.text();
  if (!verifyShopifyWebhook(raw, request.headers.get("x-shopify-hmac-sha256"))) {
    console.warn("[shopify:webhook] HMAC doğrulanamadı");
    return jsonError(401, "İmza geçersiz.");
  }
  const shop = request.headers.get("x-shopify-shop-domain");
  const expectedShop = env().SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (expectedShop && shop && shop !== expectedShop) return jsonError(401, "Mağaza eşleşmiyor.");

  const topic = request.headers.get("x-shopify-topic") ?? "";
  const webhookId = request.headers.get("x-shopify-webhook-id") ?? request.headers.get("x-shopify-event-id") ?? "";
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return jsonError(400, "Geçersiz gövde.");
  }

  const event = await recordWebhookEvent("SHOPIFY", webhookId || `${topic}:${String(payload.id ?? "")}`, topic, payload);
  if (!event.isNew) return Response.json({ ok: true, duplicate: true });

  try {
    if (topic === "orders/paid" || topic === "orders/create") {
      await processShopifyPaidOrder(parseShopifyOrderPayload(payload));
    } else if (topic === "refunds/create") {
      const orderId = payload.order_id;
      if (orderId != null) await processShopifyRefundOrCancel(`gid://shopify/Order/${orderId}`, null);
    } else if (topic === "orders/cancelled") {
      const view = parseShopifyOrderPayload(payload);
      await processShopifyRefundOrCancel(view.gid, view);
    }
    await completeWebhookEvent(event.id!);
    return Response.json({ ok: true });
  } catch (err) {
    await completeWebhookEvent(event.id!, (err as Error).message);
    console.error("[shopify:webhook]", err);
    return jsonError(500, "İşlenemedi.");
  }
}
