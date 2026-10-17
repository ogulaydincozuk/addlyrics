import "server-only";
import type { Payment } from "@prisma/client";
import { decimalToKurus, kurusToDecimalString } from "@/lib/money";
import { hmacSha256, safeEqual } from "../crypto";
import { env, iyzicoConfigured } from "../env";
import type { InitializeInput, InitializeResult, PaymentGateway, VerifiedResult } from "./types";
import { PaymentGatewayError } from "./types";

/**
 * iyzico Checkout Form entegrasyonu (barındırılan ödeme sayfası).
 * Kart bilgileri yalnızca iyzico sayfasında girilir; AddLyrics kart verisi görmez ve saklamaz.
 *
 * Kimlik doğrulama (IYZWSv2):
 *   imza   = hex(HMAC-SHA256(secretKey, randomKey + uriPath + jsonBody))
 *   başlık = "IYZWSv2 " + base64("apiKey:" + apiKey + "&randomKey:" + randomKey + "&signature:" + imza)
 */

const INIT_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const DETAIL_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail";

export function iyzicoAuthHeaders(apiKey: string, secretKey: string, path: string, body: string, randomKey: string) {
  const signature = hmacSha256(secretKey, randomKey + path + body, "hex");
  const authorization = Buffer.from(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`).toString("base64");
  return {
    Authorization: `IYZWSv2 ${authorization}`,
    "x-iyzi-rnd": randomKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function iyzicoRequest(path: string, payload: Record<string, unknown>) {
  if (!iyzicoConfigured()) throw new PaymentGatewayError("iyzico API anahtarları tanımlı değil.");
  const e = env();
  const body = JSON.stringify(payload);
  const randomKey = `${Date.now()}${Math.floor(Math.random() * 1e9)}`;
  const res = await fetch(new URL(path, e.IYZICO_BASE_URL), {
    method: "POST",
    headers: iyzicoAuthHeaders(e.IYZICO_API_KEY!, e.IYZICO_SECRET_KEY!, path, body, randomKey),
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) throw new PaymentGatewayError(`iyzico yanıtı okunamadı (HTTP ${res.status}).`);
  return json;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { name: parts[0]!, surname: parts[0]! };
  return { name: parts.slice(0, -1).join(" "), surname: parts.at(-1)! };
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("90")) return `+${digits}`;
  if (digits.startsWith("0")) return `+9${digits}`;
  return `+90${digits}`;
}

/** Saklanacak özet — kart numarası parçaları (bin/son dört hane) dahil edilmez. */
function sanitize(r: Record<string, unknown>) {
  const keep = [
    "status",
    "paymentStatus",
    "paymentId",
    "price",
    "paidPrice",
    "currency",
    "basketId",
    "conversationId",
    "fraudStatus",
    "errorCode",
    "errorMessage",
    "cardAssociation",
    "cardFamily",
    "installment",
    "mdStatus",
  ];
  return Object.fromEntries(keep.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]));
}

export class IyzicoGateway implements PaymentGateway {
  readonly id = "IYZICO" as const;

  async initialize(input: InitializeInput): Promise<InitializeResult> {
    const price = kurusToDecimalString(input.payment.amountKurus);
    const { name, surname } = splitName(input.buyer.fullName);
    const res = await iyzicoRequest(INIT_PATH, {
      locale: "tr",
      conversationId: input.payment.conversationId,
      price,
      paidPrice: price,
      currency: input.payment.currency,
      basketId: input.order.number,
      paymentGroup: "PRODUCT",
      callbackUrl: input.callbackUrl,
      // Taksit kapalı: ödenen tutar paket fiyatına eşit kalır
      enabledInstallments: [1],
      buyer: {
        id: input.buyer.id,
        name,
        surname,
        gsmNumber: normalizePhone(input.buyer.phone),
        email: input.buyer.email,
        // T.C. kimlik no verilmediyse iyzico'nun kabul ettiği varsayılan değer kullanılır
        identityNumber: input.buyer.identityNumber ?? "11111111111",
        registrationAddress: input.buyer.address,
        ip: input.buyer.ip,
        city: input.buyer.city,
        country: "Turkey",
      },
      billingAddress: {
        contactName: input.buyer.fullName,
        city: input.buyer.city,
        country: "Turkey",
        address: input.buyer.address,
      },
      basketItems: [
        {
          id: input.order.packageId,
          name: input.order.packageName,
          category1: "Lyrics Video Paketi",
          itemType: "VIRTUAL",
          price,
        },
      ],
    });

    if (res.status !== "success" || typeof res.token !== "string" || typeof res.paymentPageUrl !== "string") {
      throw new PaymentGatewayError(`iyzico ödeme başlatılamadı: ${String(res.errorMessage ?? "bilinmeyen hata")}`, sanitize(res));
    }
    return { token: res.token, checkoutUrl: res.paymentPageUrl };
  }

  async retrieve(token: string, payment: Payment): Promise<VerifiedResult> {
    const res = await iyzicoRequest(DETAIL_PATH, { locale: "tr", conversationId: payment.conversationId, token });
    const raw = sanitize(res);
    if (res.status !== "success") {
      return { status: "FAILED", failureReason: String(res.errorMessage ?? "Ödeme doğrulanamadı."), raw };
    }
    const paymentStatus = String(res.paymentStatus ?? "");
    const common = {
      conversationId: typeof res.conversationId === "string" ? res.conversationId : null,
      basketReference: typeof res.basketId === "string" ? res.basketId : null,
      providerPaymentId: res.paymentId != null ? String(res.paymentId) : null,
      amountKurus: res.price != null ? decimalToKurus(String(res.price)) : null,
      currency: typeof res.currency === "string" ? res.currency : null,
      raw,
    };
    if (paymentStatus === "SUCCESS") {
      const fraud = Number(res.fraudStatus ?? 1);
      if (fraud === -1) return { ...common, status: "FAILED", failureReason: "Ödeme iyzico tarafından reddedildi." };
      if (fraud === 0) return { ...common, status: "PENDING", failureReason: "Ödeme iyzico incelemesinde." };
      return { ...common, status: "SUCCEEDED" };
    }
    if (paymentStatus === "FAILURE") {
      return { ...common, status: "FAILED", failureReason: String(res.errorMessage ?? "Ödeme başarısız oldu.") };
    }
    // INIT_THREEDS, CALLBACK_THREEDS vb. ara durumlar
    return { ...common, status: "PENDING" };
  }
}

/**
 * iyzico webhook imzası (X-IYZ-SIGNATURE-V3), Checkout Form biçimi:
 *   hex(HMAC-SHA256(secretKey, secretKey + iyziEventType + iyziPaymentId + token + paymentConversationId + status))
 * Kaynak: docs.iyzico.com → Webhook. İmza özelliği iyzico tarafından hesapta açılmalıdır.
 */
export function verifyIyzicoWebhookSignature(
  body: { iyziEventType?: unknown; iyziPaymentId?: unknown; token?: unknown; paymentConversationId?: unknown; status?: unknown },
  signature: string | null,
  secretKey = env().IYZICO_SECRET_KEY,
) {
  if (!signature || !secretKey) return false;
  const message =
    secretKey +
    String(body.iyziEventType ?? "") +
    String(body.iyziPaymentId ?? "") +
    String(body.token ?? "") +
    String(body.paymentConversationId ?? "") +
    String(body.status ?? "");
  const expected = hmacSha256(secretKey, message, "hex");
  return safeEqual(expected.toLowerCase(), signature.trim().toLowerCase());
}
