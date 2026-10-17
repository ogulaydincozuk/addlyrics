import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Input } from "@/components/ui/field";
import { Badge, KeyValue } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { bpsLabel, COMMISSION_BASE_LABEL, COMMISSION_STATUS_LABEL } from "@/lib/referral";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../../_forms";
import { AdminPage, Section, Table, Td, Th } from "../../_ui";
import { createCodeAction, createPartnerLoginAction, updatePartnerAction } from "../actions";
import { CodeFields, PartnerFields } from "../fields";

export const metadata: Metadata = { title: "İş Ortağı" };

export default function PartnerDetailPage({ params }: PageProps<"/admin/is-ortaklari/[id]">) {
  return (
    <AdminPage title="İş Ortağı">
      <PartnerDetail params={params} />
    </AdminPage>
  );
}

async function PartnerDetail({ params }: Pick<PageProps<"/admin/is-ortaklari/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const partner = await db.partner.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, disabledAt: true } },
      codes: { orderBy: { createdAt: "desc" }, include: { packages: { select: { name: true } } } },
      commissions: { orderBy: { createdAt: "desc" }, take: 50, include: { order: { select: { number: true } } } },
    },
  });
  if (!partner) notFound();
  const packages = await db.package.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } });
  const social = (partner.socialAccounts as Array<{ platform: string; handle: string }>) ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <Section title={partner.name} actions={partner.active ? <Badge tone="success">Aktif</Badge> : <Badge>Pasif</Badge>}>
          <ActionForm action={updatePartnerAction.bind(null, partner.id)} submitLabel="Kaydet">
            <PartnerFields
              defaults={{
                name: partner.name,
                email: partner.email,
                phone: partner.phone,
                social: social.map((s) => `${s.platform}: ${s.handle}`).join("\n"),
                notes: partner.notes,
                active: partner.active,
              }}
            />
          </ActionForm>
        </Section>

        <Section title="Referans kodları" description="Kodları yalnızca yöneticiler oluşturur ve düzenler; iş ortağı yalnızca görüntüler.">
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th>Kod</Th>
                <Th>İndirim</Th>
                <Th>Komisyon</Th>
                <Th>Geçerlilik</Th>
                <Th>Kullanım</Th>
              </tr>
            </thead>
            <tbody>
              {partner.codes.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <Link href={`/admin/referans-kodlari/${c.id}`} className="font-semibold text-brand hover:underline">
                      {c.code}
                    </Link>{" "}
                    {!c.active && <Badge>Pasif</Badge>}
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
                    {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                  </Td>
                </tr>
              ))}
              {partner.codes.length === 0 && (
                <tr>
                  <Td className="py-6 text-muted">Bu iş ortağına henüz kod atanmadı.</Td>
                </tr>
              )}
            </tbody>
          </Table>
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-semibold text-brand">Bu iş ortağına yeni kod ata</summary>
            <div className="mt-4">
              <ActionForm action={createCodeAction} submitLabel="Kodu oluştur">
                <CodeFields partners={[]} packages={packages} fixedPartnerId={partner.id} />
              </ActionForm>
            </div>
          </details>
        </Section>

        <Section title="Son komisyonlar">
          <Table minWidth={640}>
            <thead>
              <tr>
                <Th>Sipariş</Th>
                <Th>Tutar</Th>
                <Th>Durum</Th>
                <Th>Tarih</Th>
              </tr>
            </thead>
            <tbody>
              {partner.commissions.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <Link href={`/admin/siparisler/${c.order.number}`} className="text-brand hover:underline">
                      {c.order.number}
                    </Link>
                  </Td>
                  <Td>{formatMoney(c.amountKurus)}</Td>
                  <Td>
                    {COMMISSION_STATUS_LABEL[c.status]}
                    {c.clawbackAt && <Badge tone="danger" className="ml-1">İade — mahsup</Badge>}
                  </Td>
                  <Td>{formatDate(c.createdAt)}</Td>
                </tr>
              ))}
              {partner.commissions.length === 0 && (
                <tr>
                  <Td className="py-6 text-muted">Henüz komisyon yok.</Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Section>
      </div>

      <aside className="min-w-0 space-y-6">
        <Section title="Panel erişimi" description="İş ortağı yalnızca kendi kodlarını, satışlarını ve kazançlarını görür.">
          {partner.user ? (
            <KeyValue label="Hesap">
              {partner.user.email} {partner.user.disabledAt ? <Badge>Kapalı</Badge> : <Badge tone="success">Açık</Badge>}
            </KeyValue>
          ) : (
            <ActionForm action={createPartnerLoginAction.bind(null, partner.id)} submitLabel="Panel hesabı oluştur">
              <Input name="email" type="email" defaultValue={partner.email ?? ""} placeholder="ortak@ornek.com" aria-label="Giriş e-postası" required />
              <p className="text-xs text-muted">Şifre belirleme bağlantısı bu adrese gönderilir (72 saat geçerli).</p>
            </ActionForm>
          )}
        </Section>
        {social.length > 0 && (
          <Section title="Sosyal medya">
            <ul className="space-y-1 text-sm">
              {social.map((s) => (
                <li key={`${s.platform}${s.handle}`}>
                  <span className="text-muted">{s.platform}:</span> {s.handle}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </aside>
    </div>
  );
}
