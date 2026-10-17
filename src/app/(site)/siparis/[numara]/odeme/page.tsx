import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CreditCard, ShieldCheck } from "lucide-react";
import { Alert, Badge, Card, Container, PageSkeleton } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { formatMoney } from "@/lib/money";
import { snapshotTotalVideos, videoCountLabel, type PackageSnapshot } from "@/lib/packages";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { activeProviderId } from "@/server/payments/config";
import { removeCodeAction, startPaymentAction } from "./actions";
import { BillingForm } from "./billing-form";
import { ReferralCodeForm } from "./code-form";

export const metadata: Metadata = { title: "Ödeme", robots: { index: false } };

export default function PaymentPage({ params }: PageProps<"/siparis/[numara]/odeme">) {
  return (
    <Container className="py-8 sm:py-12">
      <Suspense fallback={<PageSkeleton />}>
        <PaymentContent params={params} />
      </Suspense>
    </Container>
  );
}

async function PaymentContent({ params }: Pick<PageProps<"/siparis/[numara]/odeme">, "params">) {
  const { numara } = await params;
  const user = await requireUser(`/siparis/${numara}/odeme`);
  const order = await db.order.findFirst({
    where: { number: numara, userId: user.id },
    include: {
      song: { select: { artistName: true, title: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      referralCode: { select: { code: true } },
      trialApplication: { select: { number: true } },
    },
  });
  if (!order) notFound();
  if (order.kind !== "PURCHASE" || order.status !== "PAYMENT_PENDING") redirect(`/panel/siparislerim/${order.number}`);

  const t = messages();
  const snapshot = order.packageSnapshot as unknown as PackageSnapshot;
  const provider = activeProviderId();
  const lastPayment = order.payments[0];
  const amountLabel = formatMoney(order.priceKurus, order.currency);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <Link href={`/panel/siparislerim/${order.number}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Sipariş detayına dön
        </Link>
        <div>
          <p className="text-sm font-semibold text-brand">Sipariş {order.number}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">Fatura bilgileri ve ödeme</h1>
          <p className="mt-2 text-muted">Siparişin kaydedildi. Ödemeni tamamladığında paketin aktifleşir ve ekibimiz çalışmaya başlar.</p>
        </div>

        {lastPayment?.status === "FAILED" && (
          <Alert tone="danger" title="Önceki ödeme denemesi tamamlanamadı">
            Kartından tahsilat yapılmadı. Bilgilerini kontrol edip tekrar deneyebilirsin.
          </Alert>
        )}
        {!provider && (
          <Alert tone="warning" title="Online ödeme henüz aktif değil">
            Ödeme altyapısı yapılandırıldığında bu sayfadan ödemeni tamamlayabilirsin. Siparişin kayıtlı ve müşteri panelinde görünüyor.{" "}
            <Link href={`/panel/siparislerim/${order.number}`} className="font-semibold underline">
              Siparişine git
            </Link>
          </Alert>
        )}
        {provider === "MOCK" && (
          <Alert tone="info" title="Test modu">
            Bu ortamda gerçek ödeme alınmaz. Bir sonraki adımda test ödeme sayfası açılır.
          </Alert>
        )}

        <Card className="p-5 sm:p-6">
          <ReferralCodeForm
            orderNumber={order.number}
            appliedCode={order.referralCode?.code ?? null}
            discountLabel={order.discountKurus > 0 ? formatMoney(order.discountKurus, order.currency) : null}
            remove={removeCodeAction.bind(null, order.number)}
          />
        </Card>

        <Card className="p-5 sm:p-8">
          <BillingForm
            action={startPaymentAction.bind(null, order.number)}
            defaults={{
              billingName: order.billingName ?? user.name,
              billingPhone: order.billingPhone ?? "",
              billingCity: order.billingCity ?? "",
              billingAddress: order.billingAddress ?? "",
              billingIdentityNumber: "",
            }}
            amountLabel={amountLabel}
            providerLabel={provider ? t.enums.paymentProvider[provider] : "ödeme kuruluşunun"}
            disabled={!provider}
          />
        </Card>
      </div>

      <aside className="lg:sticky lg:top-24">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <p className="font-display text-lg font-bold text-ink">{snapshot.name}</p>
            {snapshot.isSample && <Badge tone="warning">Örnek veri</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {order.song.artistName} – {order.song.title}
          </p>
          {order.trialApplication && (
            <Link href="/panel/deneme/satin-al" className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">
              Farklı paket seç
            </Link>
          )}
          <dl className="mt-5 space-y-2.5 text-sm">
            {[
              ["Paket süresi", `${snapshot.durationMonths} ay`],
              ["Toplam video", videoCountLabel(snapshot.videoCount, snapshot.bonusVideoCount ?? 0)],
              ["Bu şarkı için", order.trialApplication ? `${order.videoCount} video (3'ü deneme videon)` : `${order.videoCount} video`],
              ["Video başına", formatMoney(Math.round(snapshot.priceKurus / snapshotTotalVideos(snapshot)), snapshot.currency)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {order.discountKurus > 0 && (
            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Paket fiyatı</dt>
                <dd className="font-semibold text-ink">{formatMoney(order.listPriceKurus ?? order.priceKurus + order.discountKurus, order.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-success">
                <dt>İndirim ({order.referralCode?.code})</dt>
                <dd className="font-semibold">−{formatMoney(order.discountKurus, order.currency)}</dd>
              </div>
            </dl>
          )}
          <div className="mt-5 flex items-end justify-between border-t border-line pt-4">
            <span className="text-sm font-semibold text-ink">Toplam</span>
            <span className="font-display text-2xl font-extrabold text-ink">{amountLabel}</span>
          </div>
          <ul className="mt-5 space-y-2 text-xs text-muted">
            <li className="flex gap-2">
              <CreditCard className="size-4 shrink-0" aria-hidden /> Tek seferlik ödeme, otomatik yenileme yok.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="size-4 shrink-0" aria-hidden /> Paket hakların ödeme sağlayıcısından doğrulama geldikten sonra tanımlanır.
            </li>
          </ul>
        </Card>
      </aside>
    </div>
  );
}
