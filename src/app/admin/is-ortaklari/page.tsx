import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../_forms";
import { AdminPage, Section, Table, Td, Th } from "../_ui";
import { createPartnerAction } from "./actions";
import { PartnerFields } from "./fields";

export const metadata: Metadata = { title: "İş Ortakları" };

export default function PartnersPage() {
  return (
    <AdminPage title="İş Ortakları" description="Anlaşmalı sosyal medya sayfaları, rap sayfaları ve içerik üreticileri.">
      <Partners />
    </AdminPage>
  );
}

async function Partners() {
  await requireAdmin();
  const [partners, sums] = await Promise.all([
    db.partner.findMany({
      orderBy: { createdAt: "desc" },
      include: { codes: { select: { id: true, code: true, active: true } }, user: { select: { email: true } }, _count: { select: { orders: true } } },
    }),
    db.commission.groupBy({ by: ["partnerId", "status"], _sum: { amountKurus: true } }),
  ]);
  const sum = (partnerId: string, status: string) => sums.find((s) => s.partnerId === partnerId && s.status === status)?._sum.amountKurus ?? 0;

  return (
    <div className="space-y-6">
      <Table minWidth={960}>
        <thead>
          <tr>
            <Th>İş ortağı</Th>
            <Th>Durum</Th>
            <Th>Kodlar</Th>
            <Th>Atfedilen sipariş</Th>
            <Th>Bekleyen</Th>
            <Th>Onaylı</Th>
            <Th>Ödenen</Th>
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => (
            <tr key={p.id}>
              <Td>
                <Link href={`/admin/is-ortaklari/${p.id}`} className="font-semibold text-brand hover:underline">
                  {p.name}
                </Link>
                <div className="text-xs text-muted">{p.user?.email ?? p.email ?? "Panel hesabı yok"}</div>
              </Td>
              <Td>{p.active ? <Badge tone="success">Aktif</Badge> : <Badge>Pasif</Badge>}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {p.codes.map((c) => (
                    <Link key={c.id} href={`/admin/referans-kodlari/${c.id}`} aria-label={`${c.code} kodunu aç`}>
                      <Badge tone={c.active ? "brand" : "neutral"}>{c.code}</Badge>
                    </Link>
                  ))}
                  {p.codes.length === 0 && <span className="text-muted">—</span>}
                </div>
              </Td>
              <Td>{p._count.orders}</Td>
              {(["PENDING", "APPROVED", "PAID"] as const).map((s) => (
                <Td key={s}>
                  <Link href={`/admin/komisyonlar?ortak=${p.id}&durum=${s}`} className="hover:text-brand hover:underline">
                    {formatMoney(sum(p.id, s))}
                  </Link>
                </Td>
              ))}
            </tr>
          ))}
          {partners.length === 0 && (
            <tr>
              <Td className="py-8 text-muted">Henüz iş ortağı yok.</Td>
            </tr>
          )}
        </tbody>
      </Table>

      <Section title="Yeni iş ortağı" description="Referans kodu ve komisyon oranı iş ortağı oluşturulduktan sonra tanımlanır.">
        <ActionForm action={createPartnerAction} submitLabel="İş ortağı oluştur">
          <PartnerFields />
        </ActionForm>
      </Section>
    </div>
  );
}
