import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, Clock, UploadCloud, XCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, Container, PageSkeleton } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { missingRequiredItems, REQUIRED_ITEM_LABELS } from "@/lib/order-requirements";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = { title: "Ödeme Sonucu", robots: { index: false } };

export default function PaymentResultPage({ params }: PageProps<"/siparis/[numara]/sonuc">) {
  return (
    <Container className="max-w-2xl py-10 sm:py-16">
      <Suspense fallback={<PageSkeleton />}>
        <ResultContent params={params} />
      </Suspense>
    </Container>
  );
}

async function ResultContent({ params }: Pick<PageProps<"/siparis/[numara]/sonuc">, "params">) {
  const { numara } = await params;
  const user = await requireUser(`/siparis/${numara}/sonuc`);
  const order = await db.order.findFirst({
    where: { number: numara, userId: user.id },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      song: { select: { lyrics: true, title: true, artistName: true } },
      files: { where: { status: "UPLOADED" }, select: { kind: true } },
      entitlement: true,
    },
  });
  if (!order) notFound();
  const payment = order.payments[0];
  const paid = order.paidAt != null && order.entitlement != null;

  if (paid) {
    const missing = missingRequiredItems({
      style: order.style,
      footageSource: order.footageSource,
      lyricsText: order.song.lyrics,
      fileKinds: order.files.map((f) => f.kind),
    });
    return (
      <Card className="p-6 text-center sm:p-10">
        <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden />
        <h1 className="mt-4 text-2xl font-extrabold text-ink sm:text-3xl">Ödemen alındı, paketin aktif!</h1>
        <p className="mt-3 text-muted">
          Sipariş numaran <strong className="text-ink">{order.number}</strong>. {order.song.artistName} – {order.song.title} için çalışmaya
          başlıyoruz.
        </p>
        <dl className="mx-auto mt-6 grid max-w-md gap-3 rounded-2xl bg-canvas p-4 text-left text-sm ring-1 ring-line sm:grid-cols-2">
          <div>
            <dt className="text-muted">Ödenen tutar</dt>
            <dd className="font-semibold text-ink">{payment ? formatMoney(payment.amountKurus, payment.currency) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Video hakkı</dt>
            <dd className="font-semibold text-ink">
              {order.entitlement!.totalVideos - order.entitlement!.usedVideos} / {order.entitlement!.totalVideos} kaldı
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted">Paket bitiş tarihi</dt>
            <dd className="font-semibold text-ink">
              {order.entitlement!.endsAt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" })}
            </dd>
          </div>
        </dl>
        {missing.length > 0 && (
          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-[#fde68a] bg-warning-soft p-4 text-left text-sm text-[#78350f]">
            <p className="flex items-center gap-2 font-semibold">
              <UploadCloud className="size-4" aria-hidden /> Üretime başlamamız için eksik dosyalar var
            </p>
            <ul className="mt-2 list-disc pl-5">
              {missing.map((m) => (
                <li key={m}>{REQUIRED_ITEM_LABELS[m]}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href={`/panel/siparislerim/${order.number}`}>{missing.length ? "Dosyaları Yükle" : "Siparişimi Görüntüle"}</LinkButton>
          <LinkButton href="/panel" variant="secondary">
            Panelime Git
          </LinkButton>
        </div>
      </Card>
    );
  }

  if (!payment || payment.status === "FAILED" || payment.status === "CANCELLED") {
    return (
      <Card className="p-6 text-center sm:p-10">
        <XCircle className="mx-auto size-14 text-danger" aria-hidden />
        <h1 className="mt-4 text-2xl font-extrabold text-ink">Ödeme tamamlanamadı</h1>
        <p className="mt-3 text-muted">
          Kartından tahsilat yapılmadı. Siparişin ({order.number}) kayıtlı; dilediğinde tekrar deneyebilirsin.
        </p>
        {payment?.failureReason && <p className="mx-auto mt-3 max-w-md rounded-xl bg-canvas p-3 text-sm text-ink-soft ring-1 ring-line">{payment.failureReason}</p>}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href={`/siparis/${order.number}/odeme`}>Tekrar Dene</LinkButton>
          <LinkButton href={`/panel/siparislerim/${order.number}`} variant="secondary">
            Sipariş Detayı
          </LinkButton>
          <LinkButton href="/iletisim" variant="ghost">
            Yardım Al
          </LinkButton>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 text-center sm:p-10">
      <Clock className="mx-auto size-14 text-brand" aria-hidden />
      <h1 className="mt-4 text-2xl font-extrabold text-ink">Ödemen doğrulanıyor</h1>
      <p className="mt-3 text-muted">
        Ödeme sağlayıcısından onay bekleniyor. Bu genellikle birkaç saniye sürer; sayfa kendiliğinden yenilenecek.
      </p>
      <AutoRefresh />
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <LinkButton href={`/panel/siparislerim/${order.number}`} variant="secondary">
          Sipariş Detayı
        </LinkButton>
        <LinkButton href="/panel/siparislerim" variant="ghost">
          Siparişlerime Git
        </LinkButton>
      </div>
    </Card>
  );
}
