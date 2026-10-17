import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { bpsLabel, codeAvailability, COMMISSION_BASE_LABEL } from "@/lib/referral";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../_forms";
import { AdminPage, Section, Table, Td, Th } from "../_ui";
import { createCodeAction, toggleCodeAction } from "../is-ortaklari/actions";
import { CodeFields } from "../is-ortaklari/fields";

export const metadata: Metadata = { title: "Referans Kodları" };

export default function ReferralCodesPage() {
  return (
    <AdminPage title="Referans ve İndirim Kodları" description="Kodları yalnızca yetkili yöneticiler oluşturabilir. İndirim ve komisyon hesabı sunucuda yapılır.">
      <Codes />
    </AdminPage>
  );
}

async function Codes() {
  await requireAdmin();
  const [codes, partners, packages] = await Promise.all([
    db.referralCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { partner: { select: { id: true, name: true, active: true } }, packages: { select: { name: true } }, _count: { select: { orders: true } } },
    }),
    db.partner.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    db.package.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <Table minWidth={1060}>
        <thead>
          <tr>
            <Th>Kod</Th>
            <Th>İş ortağı</Th>
            <Th>İndirim</Th>
            <Th>Komisyon</Th>
            <Th>Geçerlilik</Th>
            <Th>Kullanım</Th>
            <Th>Durum</Th>
          </tr>
        </thead>
        <tbody>
          {codes.map((c) => {
            const availability = codeAvailability({ ...c, partnerActive: c.partner.active });
            return (
              <tr key={c.id}>
                <Td>
                  <Link href={`/admin/referans-kodlari/${c.id}`} className="font-semibold text-brand hover:underline">
                    {c.code}
                  </Link>
                </Td>
                <Td>
                  <Link href={`/admin/is-ortaklari/${c.partner.id}`} className="hover:underline">
                    {c.partner.name}
                  </Link>
                </Td>
                <Td>{c.discountType === "PERCENT" ? bpsLabel(c.discountValue) : formatMoney(c.discountValue)}</Td>
                <Td>
                  {bpsLabel(c.commissionRateBps)}
                  <div className="text-xs text-muted">{COMMISSION_BASE_LABEL[c.commissionBase]}</div>
                </Td>
                <Td className="text-xs">
                  {c.startsAt ? formatDate(c.startsAt) : "—"} – {c.endsAt ? formatDate(c.endsAt) : "süresiz"}
                  <div className="text-muted">{c.packages.length ? c.packages.map((p) => p.name).join(", ") : "Tüm paketler"}</div>
                </Td>
                <Td>
                  {c.usageCount}
                  {c.usageLimit ? ` / ${c.usageLimit}` : ""} satış
                  <div className="text-xs text-muted">{c._count.orders} siparişte uygulandı</div>
                </Td>
                <Td>
                  {availability.ok ? <Badge tone="success">Geçerli</Badge> : <Badge>{availability.reason}</Badge>}
                  <div className="mt-2">
                    <ActionForm action={toggleCodeAction.bind(null, c.id, !c.active)} submitLabel={c.active ? "Pasifleştir" : "Etkinleştir"} variant="secondary" />
                  </div>
                </Td>
              </tr>
            );
          })}
          {codes.length === 0 && (
            <tr>
              <Td className="py-8 text-muted">Henüz kod yok.</Td>
            </tr>
          )}
        </tbody>
      </Table>

      <Section title="Yeni kod" description="Örnek: %10 müşteri indirimi. Komisyon oranı ve hesaplama tabanı ticari anlaşmaya göre girilmelidir.">
        {partners.length === 0 ? (
          <p className="text-sm text-muted">
            Önce{" "}
            <Link href="/admin/is-ortaklari" className="font-semibold text-brand hover:underline">
              bir iş ortağı oluşturun
            </Link>
            .
          </p>
        ) : (
          <ActionForm action={createCodeAction} submitLabel="Kodu oluştur">
            <CodeFields partners={partners} packages={packages} />
          </ActionForm>
        )}
      </Section>
    </div>
  );
}
