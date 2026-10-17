import "server-only";
import type { PaymentProvider } from "@prisma/client";
import { env, iyzicoConfigured, shopifyStorefrontConfigured, shopifyWebhooksConfigured, testPaymentsAllowed } from "../env";

/**
 * Seçili ve gerçekten yapılandırılmış ödeme sağlayıcısı. Anahtarlar eksikse null döner;
 * bu durumda site ödeme alınabiliyormuş gibi davranmaz.
 */
export function activeProviderId(): PaymentProvider | null {
  const selected = env().PAYMENT_PROVIDER;
  switch (selected) {
    case "mock":
      return testPaymentsAllowed() ? "MOCK" : null;
    case "iyzico":
      return iyzicoConfigured() ? "IYZICO" : null;
    case "shopify":
      return shopifyStorefrontConfigured() && shopifyWebhooksConfigured() ? "SHOPIFY" : null;
    default:
      return null;
  }
}

export type ProviderStatus = {
  id: PaymentProvider;
  label: string;
  selected: boolean;
  configured: boolean;
  missing: string[];
  note?: string;
};

/** Admin → Entegrasyonlar ekranı için durum özeti. Gizli değerler asla döndürülmez. */
export function providerStatuses(): ProviderStatus[] {
  const e = env();
  const missing = (pairs: Array<[string, string | undefined]>) => pairs.filter(([, v]) => !v).map(([k]) => k);
  return [
    {
      id: "IYZICO",
      label: "iyzico Checkout Form",
      selected: e.PAYMENT_PROVIDER === "iyzico",
      configured: iyzicoConfigured(),
      missing: missing([
        ["IYZICO_API_KEY", e.IYZICO_API_KEY],
        ["IYZICO_SECRET_KEY", e.IYZICO_SECRET_KEY],
      ]),
      note: e.IYZICO_BASE_URL.includes("sandbox") ? "Sandbox (test) ortamı" : "Canlı ortam",
    },
    {
      id: "SHOPIFY",
      label: "Shopify Storefront + Checkout",
      selected: e.PAYMENT_PROVIDER === "shopify",
      configured: shopifyStorefrontConfigured() && shopifyWebhooksConfigured(),
      missing: missing([
        ["SHOPIFY_STORE_DOMAIN", e.SHOPIFY_STORE_DOMAIN],
        ["SHOPIFY_STOREFRONT_ACCESS_TOKEN", e.SHOPIFY_STOREFRONT_ACCESS_TOKEN],
        ["SHOPIFY_WEBHOOK_SECRET", e.SHOPIFY_WEBHOOK_SECRET],
      ]),
      note: e.SHOPIFY_ADMIN_ACCESS_TOKEN
        ? "Admin API ile sipariş doğrulaması açık"
        : "SHOPIFY_ADMIN_ACCESS_TOKEN yok: siparişler yalnızca imzalı webhook ile doğrulanır",
    },
    {
      id: "MOCK",
      label: "Test ödemesi (geliştirme)",
      selected: e.PAYMENT_PROVIDER === "mock",
      configured: testPaymentsAllowed(),
      missing: testPaymentsAllowed() ? [] : ["ALLOW_TEST_PAYMENTS=true (yalnızca geliştirme)"],
      note: "Gerçek ödeme alınmaz. Üretimde otomatik olarak kapalıdır.",
    },
  ];
}
