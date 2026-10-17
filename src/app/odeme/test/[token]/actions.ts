"use server";

import { notFound, redirect } from "next/navigation";
import { db } from "@/server/db";
import { testPaymentsAllowed } from "@/server/env";
import { confirmByToken } from "@/server/payments/service";

/** Test ödeme sayfasının "sağlayıcı dönüşü". Üretimde kullanılamaz. */
export async function completeTestPayment(token: string, outcome: "success" | "failure") {
  if (!testPaymentsAllowed()) notFound();
  const payment = await db.payment.findUnique({ where: { providerToken: token }, include: { order: true } });
  if (!payment || payment.provider !== "MOCK") notFound();
  if (payment.status === "PENDING") {
    await db.payment.update({ where: { id: payment.id }, data: { mockOutcome: outcome } });
    await confirmByToken("MOCK", token);
  }
  redirect(`/siparis/${payment.order.number}/sonuc`);
}
