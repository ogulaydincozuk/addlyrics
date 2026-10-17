import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { formatMoney } from "@/lib/money";
import { MISSING_FIELD_LABELS, missingSaleFields, perVideoKurus, totalVideoCount } from "@/lib/packages";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { packageSaleState, SALE_STATE_MESSAGES } from "@/server/domain/packages";
import { AdminPage, Table, Td, Th } from "../_ui";

export const metadata: Metadata = { title: "Paketler" };

export default function AdminPackagesPage() {
  return (
    <AdminPage
      title="Paketler"
      description="Fiyat, video sayısı ve teslimat koşulları. Fiyatı veya koşulları eksik paketler satın alınamaz."
      actions={
        <LinkButton href="/admin/paketler/yeni" size="sm" icon={<Plus className="size-4" aria-hidden />}>
          Yeni paket
        </LinkButton>
      }
    >
      <Packages />
    </AdminPage>
  );
}

async function Packages() {
  await requireAdmin();
  const t = messages();
  const packages = await db.package.findMany({
    orderBy: [{ sortOrder: "asc" }, { durationMonths: "asc" }],
    include: { channelListings: true, _count: { select: { orders: true } } },
  });
  return (
    <Table minWidth={960}>
      <thead>
        <tr>
          <Th>Paket</Th>
          <Th>Süre</Th>
          <Th>Fiyat</Th>
          <Th>Video</Th>
          <Th>Video başına</Th>
          <Th>Durum</Th>
          <Th>Satış</Th>
          <Th>Shopify</Th>
        </tr>
      </thead>
      <tbody>
        {packages.map((p) => {
          const state = packageSaleState(p);
          const missing = missingSaleFields(p);
          const pv = perVideoKurus(p);
          const listing = p.channelListings.find((l) => l.channel === "SHOPIFY");
          return (
            <tr key={p.id} className="hover:bg-canvas">
              <Td>
                <Link href={`/admin/paketler/${p.id}`} className="font-semibold text-brand hover:underline">
                  {p.name}
                </Link>
                <p className="text-xs text-muted">
                  /{p.slug} · {p._count.orders} sipariş
                </p>
                {p.isSample && (
                  <Badge tone="warning" className="mt-1">
                    Örnek veri
                  </Badge>
                )}
              </Td>
              <Td>{p.durationMonths} ay</Td>
              <Td className="whitespace-nowrap">{p.priceKurus != null ? formatMoney(p.priceKurus, p.currency) : <span className="text-muted">Belirlenmedi</span>}</Td>
              <Td>
                {p.videoCount != null ? (
                  <>
                    {p.videoCount}
                    {p.bonusVideoCount > 0 && <span className="text-success"> +{p.bonusVideoCount}</span>}
                    <span className="block text-xs text-muted">toplam {totalVideoCount(p)}</span>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Td>
              <Td className="whitespace-nowrap">{pv != null ? formatMoney(pv, p.currency) : "—"}</Td>
              <Td>
                <Badge tone={p.status === "PUBLISHED" ? "success" : p.status === "DRAFT" ? "neutral" : "warning"}>{t.enums.packageStatus[p.status]}</Badge>
              </Td>
              <Td className="max-w-56 text-xs">
                {state.purchasable ? (
                  <span className="font-semibold text-success">Satın alınabilir</span>
                ) : (
                  <span className="text-muted">
                    {SALE_STATE_MESSAGES[state.reason]}
                    {missing.length > 0 && <span className="block">Eksik: {missing.map((m) => MISSING_FIELD_LABELS[m]).join(", ")}</span>}
                  </span>
                )}
              </Td>
              <Td className="text-xs">
                {listing ? (
                  listing.externalPriceKurus === p.priceKurus && listing.lastSyncedAt ? (
                    <span className="text-success">Eşlendi, fiyat doğru</span>
                  ) : (
                    <span className="text-warning">Eşlendi, doğrulanmadı</span>
                  )
                ) : (
                  <span className="text-muted">Eşlenmedi</span>
                )}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
