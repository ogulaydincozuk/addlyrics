import "server-only";
import type { Payment, PaymentProvider } from "@prisma/client";

export type InitializeInput = {
  payment: Pick<Payment, "id" | "conversationId" | "amountKurus" | "currency">;
  order: { id: string; number: string; packageId: string; packageName: string };
  buyer: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    city: string;
    address: string;
    identityNumber: string | null;
    ip: string;
  };
  /** Sağlayıcının ödeme sonrası müşteriyi göndereceği adres */
  callbackUrl: string;
  /** Shopify için paketin eşlendiği varyant (GID) */
  shopifyVariantId?: string | null;
};

export type InitializeResult = {
  token: string;
  checkoutUrl: string;
};

/**
 * Sağlayıcıdan sunucu-sunucu doğrulanmış ödeme sonucu.
 * Ödeme tutarı ve referanslar burada döner; servis bunları kendi kayıtlarıyla karşılaştırır.
 */
export type VerifiedResult = {
  status: "SUCCEEDED" | "FAILED" | "PENDING";
  conversationId?: string | null;
  basketReference?: string | null;
  providerPaymentId?: string | null;
  providerReference?: string | null;
  amountKurus?: number | null;
  currency?: string | null;
  failureReason?: string | null;
  /** Kart bilgisi içermeyen özet */
  raw: Record<string, unknown>;
};

export interface PaymentGateway {
  readonly id: PaymentProvider;
  initialize(input: InitializeInput): Promise<InitializeResult>;
  /** Token ile sonucu sağlayıcıdan (ya da test kaydından) doğrular. */
  retrieve(token: string, payment: Payment): Promise<VerifiedResult>;
}

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}
