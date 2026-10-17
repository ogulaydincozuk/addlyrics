import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Badge, KeyValue } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { bpsLabel, COMMISSION_BASE_LABEL, COMMISSION_STATUS_LABEL } from "@/lib/referral";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../../_forms";
import { AdminPage, Section, Table, Td, Th } from "../../_ui";
import { createCodeAction, createPartnerLoginAction, resendPartnerLoginAction, updatePartnerAction } from "../actions";
import { CodeFields, PartnerFields } from "../fields";

export const metadata: Metadata = { title: "İş Ortağı" };

export default function PartnerDetailPage({ params }: PageProps<"/admin/is-ortaklari/[id]">) {
  return (
    <div>
      <Link href="/admin/is-ortaklari" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden /> İş ortakları
      </Link>
      <AdminPage title="İş Ortağı">
        <PartnerDetail params={params} />
      </AdminPage>
    </div>
  );
}

async function PartnerDetail({ params }: Pick<PageProps<"/admin/is-ortaklari/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const partner = await db.partner.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, disabledAt: true } },
      codes: { orderBy: { createdAt: "desc" }, include: { packages: { select: { name: true } }, packageRates: { select: { commissionRateBps: true, package: { select: { name: true, sortOrder: true } } } } } },
      commissions: { orderBy: { createdAt: "desc" }, take: 50, include: { order: { select: { number: true } } } },
      payouts: { orderBy: { paidAt: "desc" }, take: 20, include: { _count: { select: { commissions: true } } } },
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
                    {c.packageRates.length ? `Genel ${bpsLabel(c.commissionRateBps)}` : bpsLabel(c.commissionRateBps)}
                    {[...c.packageRates]
                      .sort((a, b) => a.package.sortOrder - b.package.sortOrder)
                      .map((r) => (
                        <div key={r.package.name} className="text-xs text-ink-soft">
                          {r.package.name}: <strong>{bpsLabel(r.commissionRateBps)}</strong>
                        </div>
                      ))}
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

        <Section
          title="Son komisyonlar"
          actions={
            <Link href={`/admin/komisyonlar?ortak=${partner.id}`} className="text-sm font-semibold text-brand hover:underline">
              Tümünü gör / onayla →
            </Link>
          }
        >
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

        <Section
          title="Komisyon ödemeleri"
          actions={
            <Link href="/admin/komisyon-odemeleri" className="text-sm font-semibold text-brand hover:underline">
              Ödeme kaydet →
            </Link>
          }
        >
          <Table minWidth={600}>
            <thead>
              <tr>
                <Th>Tarih</Th>
                <Th>Net tutar</Th>
                <Th>Komisyon</Th>
                <Th>Yöntem / referans</Th>
              </tr>
            </thead>
            <tbody>
              {partner.payouts.map((p) => (
                <tr key={p.id}>
                  <Td>{formatDate(p.paidAt)}</Td>
                  <Td className="font-semibold">{formatMoney(p.amountKurus)}</Td>
                  <Td>
                    <Badge>{p._count.commissions} kayıt</Badge>
                  </Td>
                  <Td>
                    {p.method}
                    {p.reference && <div className="text-xs text-muted">{p.reference}</div>}
                  </Td>
                </tr>
              ))}
              {partner.payouts.length === 0 && (
                <tr>
                  <Td className="py-6 text-muted">Henüz ödeme kaydı yok.</Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Section>
      </div>

      <aside className="min-w-0 space-y-6">
        <Section title="Panel erişimi" description="İş ortağı yalnızca kendi kodlarını, satışlarını ve kazançlarını görür.">
          {partner.user ? (
            <div className="space-y-4">
              <KeyValue label="Hesap">
                {partner.user.email} {partner.user.disabledAt ? <Badge>Kapalı</Badge> : <Badge tone="success">Açık</Badge>}
              </KeyValue>
              {!partner.user.disabledAt && (
                <ActionForm
                  action={resendPartnerLoginAction.bind(null, partner.id)}
                  submitLabel="Şifre belirleme bağlantısını yeniden gönder"
                  pendingLabel="Gönderiliyor…"
                  variant="secondary"
                  confirm={`Şifre belirleme bağlantısı ${partner.user.email} adresine gönderilecek. Devam edilsin mi?`}
                >
                  <p className="text-xs text-muted">İş ortağı şifresini belirlemediyse veya unuttuysa kullanın. Bağlantı 72 saat geçerlidir.</p>
                </ActionForm>
              )}
            </div>
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
