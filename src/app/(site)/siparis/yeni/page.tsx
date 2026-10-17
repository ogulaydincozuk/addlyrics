import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderWizard } from "@/components/order/order-wizard";
import { LinkButton } from "@/components/ui/button";
import { Alert, Container, PageSkeleton } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/guards";
import { SALE_STATE_MESSAGES } from "@/server/domain/packages";
import { getPublicPackage } from "@/server/queries/public";
import { publicFileRules } from "@/server/storage/file-rules";
import { submitPurchaseOrder } from "../actions";

export const metadata: Metadata = { title: "Sipariş Oluştur", robots: { index: false } };

export default function NewOrderPage({ searchParams }: PageProps<"/siparis/yeni">) {
  return (
    <Container className="py-8 sm:py-12">
      <div className="mb-8">
        <p className="text-sm font-semibold text-brand">Sipariş</p>
        <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">Şarkını gönder, videolarını planlayalım</h1>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <NewOrderContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function NewOrderContent({ searchParams }: Pick<PageProps<"/siparis/yeni">, "searchParams">) {
  const params = await searchParams;
  const slug = typeof params.paket === "string" ? params.paket : "";
  if (!slug) notFound();
  const user = await requireUser(`/siparis/yeni?paket=${encodeURIComponent(slug)}`);

  const pkg = await getPublicPackage(slug);
  if (!pkg) notFound();
  if (!pkg.saleState.purchasable) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Alert tone="warning" title={`${pkg.name} şu anda satın alınamıyor`}>
          {SALE_STATE_MESSAGES[pkg.saleState.reason]}
        </Alert>
        <LinkButton href="/paketler" variant="secondary">
          Paketlere dön
        </LinkButton>
      </div>
    );
  }

  return (
    <OrderWizard
      mode="purchase"
      pkg={{
        name: pkg.name,
        durationMonths: pkg.durationMonths,
        priceKurus: pkg.priceKurus,
        currency: pkg.currency,
        totalVideos: pkg.totalVideos!,
        bonusVideos: pkg.bonusVideoCount,
        maxVideosForOrder: pkg.totalVideos!,
        deliveryTerms: pkg.deliveryTerms!,
        deliveryDays: pkg.deliveryDays,
        includedFormats: pkg.includedFormats,
        includedStyles: pkg.includedStyles,
        isSample: pkg.isSample,
      }}
      rules={publicFileRules()}
      defaultArtistName={user.artistName ?? ""}
      draftKey={`addlyrics-order:${user.id}:${slug}`}
      submit={submitPurchaseOrder.bind(null, slug)}
    />
  );
}
