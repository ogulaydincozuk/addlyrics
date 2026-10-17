import type { Metadata } from "next";
import Link from "next/link";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/primitives";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../_forms";
import { AdminPage, Section, Table, Td, Th } from "../_ui";
import { recordPayoutAction } from "../is-ortaklari/actions";

export const metadata: Metadata = { title: "Komisyon Ödemeleri" };

export default function PayoutsPage() {
  return (
    <AdminPage
      title="Komisyon Ödemeleri"
      description="Yalnızca onaylanmış komisyonlar ödenebilir. Ödeme sonrası iade edilen satışların komisyonu bir sonraki ödemeden mahsup edilir. Her ödeme denetim kaydına yazılır."
    >
      <Payouts />
    </AdminPage>
  );
}

async function Payouts() {
  await requireAdmin();
  const [approved, clawbacks, payouts] = await Promise.all([
    db.commission.findMany({
      where: { status: "APPROVED" },
      orderBy: { approvedAt: "asc" },
      include: { partner: { select: { id: true, name: true } }, order: { select: { number: true } } },
    }),
    db.commission.findMany({ where: { status: "PAID", clawbackAt: { not: null }, clawbackPayoutId: null }, select: { partnerId: true, amountKurus: true } }),
    db.commissionPayout.findMany({
      orderBy: { paidAt: "desc" },
      take: 100,
      include: { partner: { select: { id: true, name: true } }, createdBy: { select: { name: true } }, _count: { select: { commissions: true } } },
    }),
  ]);

  const byPartner = new Map<string, { name: string; items: typeof approved }>();
  for (const c of approved) {
    const entry = byPartner.get(c.partnerId) ?? { name: c.partner.name, items: [] };
    entry.items.push(c);
    byPartner.set(c.partnerId, entry);
  }

  return (
    <div className="space-y-6">
      {byPartner.size === 0 && (
        <p className="text-sm text-muted">
          Ödenmeyi bekleyen onaylı komisyon yok. Önce{" "}
          <Link href="/admin/komisyonlar?onaylanabilir=1" className="font-semibold text-brand hover:underline">
            onaylanabilir komisyonları
          </Link>{" "}
          onaylayın.
        </p>
      )}
      {[...byPartner.entries()].map(([partnerId, { name, items }]) => {
        const deduction = clawbacks.filter((c) => c.partnerId === partnerId).reduce((n, c) => n + c.amountKurus, 0);
        const gross = items.reduce((n, c) => n + c.amountKurus, 0);
        return (
          <Section
            key={partnerId}
            title={name}
            description={`Onaylı: ${formatMoney(gross)}${deduction ? ` · mahsup edilecek iade: −${formatMoney(deduction)} · net: ${formatMoney(gross - deduction)}` : ""}`}
            actions={
              <Link href={`/admin/is-ortaklari/${partnerId}`} className="text-sm font-semibold text-brand hover:underline">
                İş ortağı
              </Link>
            }
          >
            <ActionForm action={recordPayoutAction.bind(null, partnerId)} submitLabel="Ödemeyi kaydet" confirm="Seçilen komisyonlar ödendi olarak işaretlenecek. Ödeme yapıldı mı?">
              <div className="grid gap-2">
                {items.map((c) => (
                  <Checkbox key={c.id} name="commissionIds" value={c.id} defaultChecked label={`${c.order.number} — ${formatMoney(c.amountKurus)} (onay: ${formatDate(c.approvedAt)})`} />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Ödeme yöntemi" htmlFor={`method-${partnerId}`}>
                  <Input id={`method-${partnerId}`} name="method" placeholder="Banka havalesi" required />
                </Field>
                <Field label="Referans / dekont no" htmlFor={`ref-${partnerId}`} optional>
                  <Input id={`ref-${partnerId}`} name="reference" />
                </Field>
                <Field label="Ödeme tarihi" htmlFor={`date-${partnerId}`}>
                  <Input id={`date-${partnerId}`} name="paidAt" type="date" defaultValue={toDateInputValue(new Date())} required />
                </Field>
              </div>
              <Field label="Not" htmlFor={`note-${partnerId}`} optional>
                <Input id={`note-${partnerId}`} name="note" />
              </Field>
            </ActionForm>
          </Section>
        );
      })}

      <Section title="Ödeme geçmişi">
        <Table minWidth={760}>
          <thead>
            <tr>
              <Th>Tarih</Th>
              <Th>İş ortağı</Th>
              <Th>Net tutar</Th>
              <Th>Komisyon</Th>
              <Th>Yöntem / referans</Th>
              <Th>Kaydeden</Th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id}>
                <Td>{formatDate(p.paidAt)}</Td>
                <Td>
                  <Link href={`/admin/is-ortaklari/${p.partner.id}`} className="text-brand hover:underline">
                    {p.partner.name}
                  </Link>
                </Td>
                <Td className="font-semibold">{formatMoney(p.amountKurus)}</Td>
                <Td>
                  <Badge>{p._count.commissions} kayıt</Badge>
                </Td>
                <Td>
                  {p.method}
                  {p.reference && <div className="text-xs text-muted">{p.reference}</div>}
                </Td>
                <Td>{p.createdBy.name}</Td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <Td className="py-6 text-muted">Henüz ödeme kaydı yok.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
