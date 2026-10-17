import "server-only";
import type { Payment } from "@prisma/client";
import { randomToken } from "../crypto";
import { testPaymentsAllowed } from "../env";
import type { InitializeInput, InitializeResult, PaymentGateway, VerifiedResult } from "./types";
import { PaymentGatewayError } from "./types";

/**
 * Geliştirme için test ödeme sağlayıcısı. GERÇEK ÖDEME ALMAZ.
 * Akış gerçek sağlayıcılarla aynıdır: başlat → barındırılan ödeme sayfası → dönüş → sunucu doğrulaması.
 * NODE_ENV=production iken kullanılamaz.
 */
export class MockGateway implements PaymentGateway {
  readonly id = "MOCK" as const;

  private guard() {
    if (!testPaymentsAllowed()) throw new PaymentGatewayError("Test ödemeleri bu ortamda kapalı.");
  }

  async initialize(_input: InitializeInput): Promise<InitializeResult> {
    this.guard();
    const token = `mock_${randomToken(18)}`;
    return { token, checkoutUrl: `/odeme/test/${token}` };
  }

  async retrieve(_token: string, payment: Payment): Promise<VerifiedResult> {
    this.guard();
    if (payment.mockOutcome === "success") {
      return {
        status: "SUCCEEDED",
        conversationId: payment.conversationId,
        providerPaymentId: `mockpay_${payment.id}`,
        providerReference: "TEST",
        amountKurus: payment.amountKurus,
        currency: payment.currency,
        raw: { provider: "mock", outcome: "success" },
      };
    }
    if (payment.mockOutcome === "failure") {
      return {
        status: "FAILED",
        conversationId: payment.conversationId,
        failureReason: "Test ödemesi başarısız olarak simüle edildi.",
        raw: { provider: "mock", outcome: "failure" },
      };
    }
    return { status: "PENDING", raw: { provider: "mock" } };
  }
}
