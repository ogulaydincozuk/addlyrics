import "server-only";
import { db } from "../db";
import { DomainError } from "../domain/errors";
import { notifyAdmins } from "../notify";
import { applyVerifiedResult, markPaymentRefunded } from "./service";
import {
  fetchShopifyOrder,
  fetchShopifyVariant,
  isShopifyGid,
  SHOPIFY_ORDER_ATTRIBUTE,
  SHOPIFY_PAYMENT_ATTRIBUTE,
  shopifyAdminConfigured,
  type ShopifyOrderView,
} from "./shopify";

export type ShopifyProcessResult = "processed" | "ignored" | "pending";

/** `orders/paid` (ve `orders/create`) — AddLyrics ödemesini doğrular ve paket hakkını tanımlar. */
export async function processShopifyPaidOrder(payloadView: ShopifyOrderView): Promise<ShopifyProcessResult> {
  const reference = payloadView.attributes[SHOPIFY_PAYMENT_ATTRIBUTE];
  if (!reference) return "ignored"; // AddLyrics dışından gelen Shopify siparişi

  // Admin API anahtarı varsa sipariş Shopify'dan yeniden okunur; webhook içeriği yalnızca ipucudur.
  const view = shopifyAdminConfigured() ? ((await fetchShopifyOrder(payloadView.gid)) ?? payloadView) : payloadView;

  const payment = await db.payment.findUnique({
    where: { conversationId: reference },
    include: { order: { include: { package: { include: { channelListings: true } } } } },
  });
  if (!payment || payment.provider !== "SHOPIFY") return "ignored";

  if (view.financialStatus !== "paid") return "pending";

  const listing = payment.order.package.channelListings.find((l) => l.channel === "SHOPIFY");
  const variantMatches = Boolean(listing && view.variantGids.includes(listing.externalVariantId));

  await applyVerifiedResult(payment, {
    status: "SUCCEEDED",
    conversationId: reference,
    basketReference: view.attributes[SHOPIFY_ORDER_ATTRIBUTE] ?? null,
    providerPaymentId: view.gid,
    providerReference: view.name,
    // Varyant eşleşmezse tutar doğrulaması bilinçli olarak başarısız kılınır
    amountKurus: variantMatches ? view.totalKurus : null,
    currency: view.currency,
    raw: {
      provider: "shopify",
      order: view.gid,
      name: view.name,
      financialStatus: view.financialStatus,
      total: view.totalKurus,
      currency: view.currency,
      variantMatches,
      verifiedWithAdminApi: shopifyAdminConfigured(),
    },
  });

  if (view.customerGid) {
    await db.externalCustomer.upsert({
      where: { userId_channel: { userId: payment.userId, channel: "SHOPIFY" } },
      create: { userId: payment.userId, channel: "SHOPIFY", externalId: view.customerGid },
      update: {},
    }).catch(() => undefined); // aynı Shopify müşterisi başka hesaba bağlıysa eşleme atlanır
  }
  return "processed";
}

/** `refunds/create` ve `orders/cancelled` — iade/iptal durumunda paket hakkını kapatır. */
export async function processShopifyRefundOrCancel(orderGid: string, payloadView: ShopifyOrderView | null) {
  const payment = await db.payment.findFirst({
    where: { provider: "SHOPIFY", providerPaymentId: orderGid },
    include: { order: true },
  });
  if (!payment) return "ignored" as const;

  const view = shopifyAdminConfigured() ? ((await fetchShopifyOrder(orderGid)) ?? payloadView) : payloadView;
  const status = view?.financialStatus ?? "";

  if (status === "refunded" || status === "voided") {
    await markPaymentRefunded(payment.id, null, `Shopify siparişi ${view?.name ?? ""} ${status === "voided" ? "iptal edildi" : "iade edildi"}.`);
    return "processed" as const;
  }
  await notifyAdmins({
    title: `Shopify iade/iptal bildirimi: ${payment.order.number}`,
    body: `Shopify ödeme durumu: "${status || "bilinmiyor"}". Kısmi iade veya doğrulanamayan durum — paket hakkı otomatik kapatılmadı, lütfen inceleyin.`,
    orderId: payment.orderId,
    href: `/admin/siparisler/${payment.order.number}`,
  });
  return "processed" as const;
}

/** Admin: paketi bir Shopify varyantıyla eşler ve fiyatı Shopify'dan doğrular. */
export async function linkPackageToShopify(packageId: string, productGid: string, variantGid: string) {
  if (!isShopifyGid(productGid, "Product") || !isShopifyGid(variantGid, "ProductVariant")) {
    throw new DomainError("Shopify kimlikleri gid://shopify/Product/… ve gid://shopify/ProductVariant/… biçiminde olmalı.");
  }
  return db.packageChannelListing.upsert({
    where: { packageId_channel: { packageId, channel: "SHOPIFY" } },
    create: { packageId, channel: "SHOPIFY", externalProductId: productGid.trim(), externalVariantId: variantGid.trim() },
    update: {
      externalProductId: productGid.trim(),
      externalVariantId: variantGid.trim(),
      externalPriceKurus: null,
      currency: null,
      lastSyncedAt: null,
    },
  });
}

export async function syncShopifyListing(packageId: string) {
  const listing = await db.packageChannelListing.findUnique({ where: { packageId_channel: { packageId, channel: "SHOPIFY" } } });
  if (!listing) throw new DomainError("Bu paket için Shopify eşlemesi yok.");
  const variant = await fetchShopifyVariant(listing.externalVariantId);
  if (!variant) throw new DomainError("Shopify varyantı bulunamadı. Kimliği kontrol edin.");
  if (variant.productGid !== listing.externalProductId) {
    throw new DomainError("Varyant, girilen Shopify ürününe ait değil.");
  }
  return db.packageChannelListing.update({
    where: { id: listing.id },
    data: { externalPriceKurus: variant.priceKurus, currency: variant.currency, lastSyncedAt: new Date() },
  });
}
