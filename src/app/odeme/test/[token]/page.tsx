import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/db";
import { testPaymentsAllowed } from "@/server/env";
import { completeTestPayment } from "./actions";

export const metadata: Metadata = { title: "Test Ödeme Sayfası", robots: { index: false, follow: false } };

/**
 * Geliştirme için barındırılan ödeme sayfası taklidi. Gerçek bir kart formu içermez ve
 * hiçbir şekilde ödeme almaz. NODE_ENV=production iken 404 döner.
 */
export default function TestPaymentPage({ params }: PageProps<"/odeme/test/[token]">) {
  // Ortam değişkenine bağlı kontrol: üretimde sayfa hiç render edilmez (gerçek 404)
  if (!testPaymentsAllowed()) notFound();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-md" />}>
        <TestPaymentContent params={params} />
      </Suspense>
    </div>
  );
}

async function TestPaymentContent({ params }: Pick<PageProps<"/odeme/test/[token]">, "params">) {
  const { token } = await params;
  if (!testPaymentsAllowed()) notFound();
  const payment = await db.payment.findUnique({ where: { providerToken: token }, include: { order: { include: { song: true } } } });
  if (!payment || payment.provider !== "MOCK") notFound();

  return (
    <Card className="w-full max-w-md overflow-hidden">
      <div className="flex items-center gap-2 bg-amber-400 px-5 py-3 text-sm font-bold text-amber-950">
        <FlaskConical className="size-4" aria-hidden />
        TEST ÖDEME SAYFASI — gerçek ödeme alınmaz
      </div>
      <div className="p-6">
        <p className="text-sm text-muted">Sipariş {payment.order.number}</p>
        <p className="mt-1 font-display text-3xl font-extrabold text-ink">{formatMoney(payment.amountKurus, payment.currency)}</p>
        <p className="mt-1 text-sm text-muted">
          {payment.order.song.artistName} – {payment.order.song.title}
        </p>

        {payment.status !== "PENDING" ? (
          <p className="mt-6 rounded-xl bg-canvas p-4 text-sm text-ink-soft ring-1 ring-line">Bu ödeme denemesi zaten sonuçlandı ({payment.status}).</p>
        ) : (
          <>
            <p className="mt-6 text-sm leading-relaxed text-ink-soft">
              Bu sayfa, gerçek ödeme sağlayıcısının (iyzico / Shopify Checkout) yerine geçen geliştirme aracıdır. Sonucu seçerek sipariş akışını
              uçtan uca test edebilirsin.
            </p>
            <div className="mt-6 grid gap-3">
              <form action={completeTestPayment.bind(null, token, "success")}>
                <Button type="submit" block size="lg" icon={<CheckCircle2 className="size-5" aria-hidden />}>
                  Başarılı ödemeyi simüle et
                </Button>
              </form>
              <form action={completeTestPayment.bind(null, token, "failure")}>
                <Button type="submit" block size="lg" variant="secondary" icon={<XCircle className="size-5 text-danger" aria-hidden />}>
                  Başarısız ödemeyi simüle et
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
