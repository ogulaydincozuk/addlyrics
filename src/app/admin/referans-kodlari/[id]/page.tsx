import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../../_forms";
import { AdminPage, Section, Table, Td, Th } from "../../_ui";
import { updateCodeAction } from "../../is-ortaklari/actions";
import { CodeFields } from "../../is-ortaklari/fields";

export const metadata: Metadata = { title: "Referans Kodu" };

export default function ReferralCodePage({ params }: PageProps<"/admin/referans-kodlari/[id]">) {
  return (
    <AdminPage title="Referans Kodu">
      <CodeDetail params={params} />
    </AdminPage>
  );
}

async function CodeDetail({ params }: Pick<PageProps<"/admin/referans-kodlari/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const code = await db.referralCode.findUnique({
    where: { id },
    include: {
      packages: { select: { id: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { number: true, createdAt: true, status: true, priceKurus: true, discountKurus: true, currency: true, commission: { select: { amountKurus: true, status: true } } },
      },
    },
  });
  if (!code) notFound();
  const [partners, packages] = await Promise.all([
    db.partner.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    db.package.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <Section title={code.code}>
        {code.usageCount > 0 && (
          <Alert tone="info" className="mb-4">
            Bu kod kullanıldı. Değişiklikler yalnızca yeni siparişlere uygulanır; geçmiş komisyonlar sipariş anındaki değerlerle saklanır. Kodun metni değiştirilemez.
          </Alert>
        )}
        <ActionForm action={updateCodeAction.bind(null, code.id)} submitLabel="Kaydet">
          <CodeFields
            partners={partners}
            packages={packages}
            defaults={{
              code: code.code,
              partnerId: code.partnerId,
              discountType: code.discountType,
              discountValue: code.discountValue,
              commissionRateBps: code.commissionRateBps,
              commissionBase: code.commissionBase,
              startsAt: code.startsAt,
              endsAt: code.endsAt,
              usageLimit: code.usageLimit,
              active: code.active,
              packageIds: code.packages.map((p) => p.id),
            }}
          />
        </ActionForm>
      </Section>
      <Section title="Kodun uygulandığı siparişler">
        <Table minWidth={720}>
          <thead>
            <tr>
              <Th>Sipariş</Th>
              <Th>Tarih</Th>
              <Th>Durum</Th>
              <Th>Tutar / indirim</Th>
              <Th>Komisyon</Th>
            </tr>
          </thead>
          <tbody>
            {code.orders.map((o) => (
              <tr key={o.number}>
                <Td>
                  <Link href={`/admin/siparisler/${o.number}`} className="text-brand hover:underline">
                    {o.number}
                  </Link>
                </Td>
                <Td>{formatDate(o.createdAt)}</Td>
                <Td>{o.status}</Td>
                <Td>
                  {formatMoney(o.priceKurus, o.currency)} <span className="text-xs text-muted">(−{formatMoney(o.discountKurus, o.currency)})</span>
                </Td>
                <Td>{o.commission ? `${formatMoney(o.commission.amountKurus)} · ${o.commission.status}` : <span className="text-muted">Ödeme yok</span>}</Td>
              </tr>
            ))}
            {code.orders.length === 0 && (
              <tr>
                <Td className="py-6 text-muted">Henüz uygulanmadı.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
