import "server-only";
import { decimalToKurus } from "@/lib/money";
import { hmacSha256, safeEqual } from "../crypto";
import { env, shopifyStorefrontConfigured } from "../env";
import type { InitializeInput, InitializeResult, PaymentGateway, VerifiedResult } from "./types";
import { PaymentGatewayError } from "./types";

/**
 * Shopify entegrasyonu (isteğe bağlı).
 *
 * Akış:
 *  1. AddLyrics siparişi ve Payment kaydı oluşturulur (fiyat AddLyrics paketinden).
 *  2. Storefront API `cartCreate` ile paketin eşlendiği varyant sepete eklenir; sepete
 *     `addlyrics_payment` ve `addlyrics_order` özellikleri yazılır. Sepet tutarı AddLyrics
 *     fiyatıyla aynı değilse ödeme başlatılmaz.
 *  3. Müşteri Shopify Checkout'a yönlenir.
 *  4. Shopify `orders/paid` webhook'u (HMAC imzalı) gelir → sipariş özellikleri, varyant,
 *     para birimi ve tutar doğrulanır → AddLyrics ödeme servisi haklarını tanımlar.
 *  5. `refunds/create` / `orders/cancelled` → iade durumunda paket hakkı iptal edilir.
 *
 * Yapılandırma yoksa hiçbir Shopify çağrısı yapılmaz ve admin panelinde "bağlı değil" görünür.
 */

export const SHOPIFY_PAYMENT_ATTRIBUTE = "addlyrics_payment";
export const SHOPIFY_ORDER_ATTRIBUTE = "addlyrics_order";

function storeDomain() {
  const domain = env().SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new PaymentGatewayError("SHOPIFY_STORE_DOMAIN tanımlı değil.");
  return domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

async function storefrontRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  if (!shopifyStorefrontConfigured()) throw new PaymentGatewayError("Shopify Storefront API yapılandırılmadı.");
  const e = env();
  const res = await fetch(`https://${storeDomain()}/api/${e.SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": e.SHOPIFY_STOREFRONT_ACCESS_TOKEN!,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { data?: T; errors?: Array<{ message: string }> } | null;
  if (!res.ok || !json || json.errors?.length || !json.data) {
    throw new PaymentGatewayError(`Shopify Storefront API hatası: ${json?.errors?.[0]?.message ?? `HTTP ${res.status}`}`);
  }
  return json.data;
}

export function shopifyAdminConfigured() {
  const e = env();
  return Boolean(e.SHOPIFY_STORE_DOMAIN && e.SHOPIFY_ADMIN_ACCESS_TOKEN);
}

async function adminRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const e = env();
  if (!shopifyAdminConfigured()) throw new PaymentGatewayError("Shopify Admin API erişim anahtarı tanımlı değil.");
  const res = await fetch(`https://${storeDomain()}/admin/api/${e.SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": e.SHOPIFY_ADMIN_ACCESS_TOKEN! },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { data?: T; errors?: unknown } | null;
  if (!res.ok || !json?.data) throw new PaymentGatewayError(`Shopify Admin API hatası (HTTP ${res.status}).`);
  return json.data;
}

// ───────────────────────────── Ödeme başlatma ─────────────────────────────

const CART_CREATE = /* GraphQL */ `
  mutation AddLyricsCartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        cost { totalAmount { amount currencyCode } }
      }
      userErrors { field message }
    }
  }
`;

type CartCreateResult = {
  cartCreate: {
    cart: { id: string; checkoutUrl: string; cost: { totalAmount: { amount: string; currencyCode: string } } } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
};

export class ShopifyGateway implements PaymentGateway {
  readonly id = "SHOPIFY" as const;

  async initialize(input: InitializeInput): Promise<InitializeResult> {
    if (!input.shopifyVariantId) {
      throw new PaymentGatewayError("Bu paket henüz bir Shopify ürünüyle eşlenmedi.");
    }
    const data = await storefrontRequest<CartCreateResult>(CART_CREATE, {
      input: {
        lines: [{ merchandiseId: input.shopifyVariantId, quantity: 1 }],
        attributes: [
          { key: SHOPIFY_PAYMENT_ATTRIBUTE, value: input.payment.conversationId },
          { key: SHOPIFY_ORDER_ATTRIBUTE, value: input.order.number },
        ],
        buyerIdentity: { email: input.buyer.email, countryCode: "TR" },
      },
    });
    const cart = data.cartCreate.cart;
    if (!cart || data.cartCreate.userErrors.length) {
      throw new PaymentGatewayError(`Shopify sepeti oluşturulamadı: ${data.cartCreate.userErrors[0]?.message ?? "bilinmeyen hata"}`);
    }
    const total = decimalToKurus(cart.cost.totalAmount.amount);
    if (total !== input.payment.amountKurus || cart.cost.totalAmount.currencyCode !== input.payment.currency) {
      throw new PaymentGatewayError(
        "Shopify'daki ürün fiyatı AddLyrics paket fiyatıyla eşleşmiyor. Admin panelinden Shopify eşlemesini doğrulayın.",
      );
    }
    return { token: cart.id, checkoutUrl: cart.checkoutUrl };
  }

  /** Shopify'da sonuç webhook ile gelir; dönüşte yalnızca bekleme durumu bildirilir. */
  async retrieve(): Promise<VerifiedResult> {
    return { status: "PENDING", raw: { provider: "shopify", note: "Shopify sonucu orders/paid webhook ile doğrulanır." } };
  }
}

// ───────────────────────────── Webhook ─────────────────────────────

/** X-Shopify-Hmac-Sha256 = base64(HMAC-SHA256(webhookSecret, hamGövde)) */
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null, secret = env().SHOPIFY_WEBHOOK_SECRET) {
  if (!hmacHeader || !secret) return false;
  const expected = hmacSha256(secret, rawBody, "base64");
  return safeEqual(expected, hmacHeader.trim());
}

export type ShopifyOrderView = {
  gid: string;
  name: string | null;
  financialStatus: string; // paid, pending, refunded, voided, partially_refunded …
  currency: string | null;
  totalKurus: number | null;
  attributes: Record<string, string>;
  variantGids: string[];
  customerGid: string | null;
  cancelled: boolean;
};

type RestOrderPayload = {
  id?: number | string;
  admin_graphql_api_id?: string;
  name?: string;
  financial_status?: string;
  currency?: string;
  total_price?: string;
  current_total_price?: string;
  note_attributes?: Array<{ name?: string; value?: string }>;
  line_items?: Array<{ variant_id?: number | string | null; quantity?: number }>;
  customer?: { id?: number | string; admin_graphql_api_id?: string } | null;
  cancelled_at?: string | null;
};

/** Webhook gövdesini (REST biçimi) ortak görünüme çevirir. */
export function parseShopifyOrderPayload(payload: RestOrderPayload): ShopifyOrderView {
  const attributes: Record<string, string> = {};
  for (const a of payload.note_attributes ?? []) if (a.name && typeof a.value === "string") attributes[a.name] = a.value;
  return {
    gid: payload.admin_graphql_api_id ?? `gid://shopify/Order/${payload.id}`,
    name: payload.name ?? null,
    financialStatus: (payload.financial_status ?? "").toLowerCase(),
    currency: payload.currency ?? null,
    totalKurus: decimalToKurus(payload.current_total_price ?? payload.total_price ?? ""),
    attributes,
    variantGids: (payload.line_items ?? [])
      .filter((l) => l.variant_id != null)
      .map((l) => `gid://shopify/ProductVariant/${l.variant_id}`),
    customerGid: payload.customer
      ? (payload.customer.admin_graphql_api_id ?? (payload.customer.id != null ? `gid://shopify/Customer/${payload.customer.id}` : null))
      : null,
    cancelled: Boolean(payload.cancelled_at),
  };
}

const ADMIN_ORDER_QUERY = /* GraphQL */ `
  query AddLyricsOrder($id: ID!) {
    order(id: $id) {
      id
      name
      displayFinancialStatus
      currencyCode
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      customAttributes { key value }
      lineItems(first: 10) { nodes { quantity variant { id } } }
      customer { id }
      cancelledAt
    }
  }
`;

/** Admin API ile siparişi Shopify'dan yeniden okur (webhook içeriğine körü körüne güvenmemek için). */
export async function fetchShopifyOrder(gid: string): Promise<ShopifyOrderView | null> {
  type Result = {
    order: {
      id: string;
      name: string;
      displayFinancialStatus: string | null;
      currencyCode: string;
      currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
      customAttributes: Array<{ key: string; value: string | null }>;
      lineItems: { nodes: Array<{ quantity: number; variant: { id: string } | null }> };
      customer: { id: string } | null;
      cancelledAt: string | null;
    } | null;
  };
  const data = await adminRequest<Result>(ADMIN_ORDER_QUERY, { id: gid });
  const o = data.order;
  if (!o) return null;
  return {
    gid: o.id,
    name: o.name,
    financialStatus: (o.displayFinancialStatus ?? "").toLowerCase(),
    currency: o.currentTotalPriceSet.shopMoney.currencyCode,
    totalKurus: decimalToKurus(o.currentTotalPriceSet.shopMoney.amount),
    attributes: Object.fromEntries(o.customAttributes.filter((a) => a.value != null).map((a) => [a.key, a.value!])),
    variantGids: o.lineItems.nodes.filter((n) => n.variant).map((n) => n.variant!.id),
    customerGid: o.customer?.id ?? null,
    cancelled: Boolean(o.cancelledAt),
  };
}

// ───────────────────────────── Ürün / fiyat eşlemesi ─────────────────────────────

const VARIANT_QUERY = /* GraphQL */ `
  query AddLyricsVariant($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id
        availableForSale
        price { amount currencyCode }
        product { id title }
      }
    }
  }
`;

/** Eşlenen Shopify varyantının güncel fiyatını Storefront API'den okur. */
export async function fetchShopifyVariant(variantGid: string) {
  type Result = {
    node: {
      id: string;
      availableForSale: boolean;
      price: { amount: string; currencyCode: string };
      product: { id: string; title: string };
    } | null;
  };
  const data = await storefrontRequest<Result>(VARIANT_QUERY, { id: variantGid });
  if (!data.node) return null;
  return {
    variantGid: data.node.id,
    productGid: data.node.product.id,
    productTitle: data.node.product.title,
    availableForSale: data.node.availableForSale,
    priceKurus: decimalToKurus(data.node.price.amount),
    currency: data.node.price.currencyCode,
  };
}

export function isShopifyGid(value: string, type: "Product" | "ProductVariant") {
  return new RegExp(`^gid://shopify/${type}/\\d+$`).test(value.trim());
}
