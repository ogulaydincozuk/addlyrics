import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { MISSING_FIELD_LABELS, missingSaleFields } from "@/lib/packages";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { packageSaleState, SALE_STATE_MESSAGES } from "@/server/domain/packages";
import { appUrl, shopifyStorefrontConfigured } from "@/server/env";
import { ActionForm } from "../../_forms";
import { AdminPage, Section } from "../../_ui";
import { linkShopifyAction, syncShopifyAction, unlinkShopifyAction } from "../actions";
import { PackageForm } from "../package-form";

export const metadata: Metadata = { title: "Paket Düzenle" };

export default function EditPackagePage({ params }: PageProps<"/admin/paketler/[id]">) {
  return (
    <div>
      <Link href="/admin/paketler" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden /> Paketler
      </Link>
      <AdminPage title="Paket düzenle">
        <Content params={params} />
      </AdminPage>
    </div>
  );
}

async function Content({ params }: Pick<PageProps<"/admin/paketler/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const pkg = await db.package.findUnique({ where: { id }, include: { channelListings: true, _count: { select: { orders: true } } } });
  if (!pkg) notFound();
  const state = packageSaleState(pkg);
  const missing = missingSaleFields(pkg);
  const listing = pkg.channelListings.find((l) => l.channel === "SHOPIFY");
  const shopifyReady = shopifyStorefrontConfigured();

  return (
    <div className="space-y-6">
      {state.purchasable ? (
        <Alert tone="success" title="Bu paket satın alınabilir">
          Sitede görünür ve sipariş verilebilir. Fiyat değişiklikleri yalnızca yeni siparişleri etkiler.
        </Alert>
      ) : (
        <Alert tone="warning" title="Bu paket şu anda satın alınamaz">
          {SALE_STATE_MESSAGES[state.reason]}
          {missing.length > 0 && <> Eksik alanlar: {missing.map((m) => MISSING_FIELD_LABELS[m]).join(", ")}.</>}
        </Alert>
      )}

      <Section title="Paket bilgileri" description={`${pkg._count.orders} sipariş bu pakete bağlı.`}>
        <PackageForm pkg={pkg} />
      </Section>

      <Section
        title="Shopify eşlemesi"
        description="İsteğe bağlı. PAYMENT_PROVIDER=shopify seçildiğinde ödeme bu Shopify varyantı üzerinden alınır; fiyatlar birebir eşleşmelidir."
      >
        {!shopifyReady && (
          <Alert tone="info" className="mb-4">
            Shopify bağlantısı yapılandırılmadı (SHOPIFY_STORE_DOMAIN ve SHOPIFY_STOREFRONT_ACCESS_TOKEN). Eşlemeyi şimdiden kaydedebilirsin; fiyat doğrulaması
            bağlantı kurulduğunda yapılır.
          </Alert>
        )}
        {listing && (
          <dl className="mb-4 grid gap-2 rounded-xl bg-canvas p-4 text-sm ring-1 ring-line sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Ürün</dt>
              <dd className="break-all">{listing.externalProductId}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Varyant</dt>
              <dd className="break-all">{listing.externalVariantId}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Shopify fiyatı</dt>
              <dd>
                {listing.externalPriceKurus != null ? formatMoney(listing.externalPriceKurus, listing.currency ?? "TRY") : "Doğrulanmadı"}
                {listing.externalPriceKurus != null && listing.externalPriceKurus !== pkg.priceKurus && (
                  <span className="ml-1 font-semibold text-danger">(AddLyrics fiyatıyla eşleşmiyor)</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Son doğrulama</dt>
              <dd>{listing.lastSyncedAt ? formatDateTime(listing.lastSyncedAt) : "—"}</dd>
            </div>
          </dl>
        )}
        <ActionForm action={linkShopifyAction.bind(null, pkg.id)} submitLabel={listing ? "Eşlemeyi güncelle" : "Eşlemeyi kaydet"} variant="secondary">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Shopify ürün kimliği" htmlFor="productGid" hint="gid://shopify/Product/1234567890">
              <Input id="productGid" name="productGid" defaultValue={listing?.externalProductId ?? ""} />
            </Field>
            <Field label="Shopify varyant kimliği" htmlFor="variantGid" hint="gid://shopify/ProductVariant/1234567890">
              <Input id="variantGid" name="variantGid" defaultValue={listing?.externalVariantId ?? ""} />
            </Field>
          </div>
        </ActionForm>
        {listing && (
          <div className="mt-4 flex flex-wrap gap-3">
            {shopifyReady && <ActionForm action={syncShopifyAction.bind(null, pkg.id)} submitLabel="Fiyatı Shopify'dan doğrula" inline />}
            <ActionForm action={unlinkShopifyAction.bind(null, pkg.id)} submitLabel="Eşlemeyi kaldır" variant="ghost" inline confirm="Shopify eşlemesi kaldırılsın mı?" />
          </div>
        )}
        <p className="mt-4 text-xs text-muted">
          Shopify webhook adresi: <code className="rounded bg-canvas px-1.5 py-0.5">{appUrl("/api/payments/shopify/webhook")}</code> (orders/paid, refunds/create,
          orders/cancelled)
        </p>
      </Section>
    </div>
  );
}
