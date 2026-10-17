import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogOut, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Alert, Badge, Card, Container, PageSkeleton } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { bpsLabel, codeAvailability, COMMISSION_STATUS_LABEL } from "@/lib/referral";
import { referralSharePath } from "@/lib/referral-link";
import { requirePartner } from "@/server/auth/guards";
import { appUrl } from "@/server/env";
import { getPartnerDashboard } from "@/server/queries/partner";
import { logout } from "../(auth)/actions";

export const metadata: Metadata = { title: "İş Ortaklığı Paneli", robots: { index: false } };

export default function PartnerPanelPage() {
  return (
    <Container className="py-8 sm:py-12">
      <Suspense fallback={<PageSkeleton />}>
        <PartnerPanel />
      </Suspense>
    </Container>
  );
}

/** İş ortağı yalnızca kendi kayıtlarını görür: tüm sorgular oturumdaki iş ortağının kimliğiyle sınırlıdır. */
async function PartnerPanel() {
  const { partner } = await requirePartner();
  const { codes, commissions, payouts, pendingOrders } = await getPartnerDashboard(partner.id);
  const sum = (pred: (c: (typeof commissions)[number]) => boolean) => commissions.filter(pred).reduce((n, c) => n + c.amountKurus, 0);
  const valid = commissions.filter((c) => c.payment.status === "SUCCEEDED" && c.status !== "CANCELLED");
  const invalid = commissions.filter((c) => c.status === "CANCELLED" || c.payment.status === "REFUNDED");
  const clawback = sum((c) => Boolean(c.clawbackAt) && c.status === "PAID");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand">İş ortaklığı paneli</p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">{partner.name}</h1>
        </div>
        <form action={logout}>
          <Button type="submit" variant="secondary" size="sm" icon={<LogOut className="size-4" aria-hidden />}>
            Çıkış Yap
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Geçerli satış", String(valid.length)],
          ["Bekleyen komisyon", formatMoney(sum((c) => c.status === "PENDING"))],
          ["Onaylanmış komisyon", formatMoney(sum((c) => c.status === "APPROVED"))],
          ["Ödenmiş komisyon", formatMoney(sum((c) => c.status === "PAID"))],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink">{value}</p>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted">
        Ödemesi beklenen sipariş: {pendingOrders} (ödeme doğrulanmadan satış sayılmaz). İptal veya iade nedeniyle geçersiz: {invalid.length}.
        {clawback > 0 && ` Ödeme sonrası iade edilen satışlardan ${formatMoney(clawback)} sonraki ödemeden mahsup edilecek.`}
      </p>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Referans kodların</h2>
        {codes.length === 0 ? (
          <Alert tone="info">
            Henüz sana atanmış bir kod yok. Kodlar AddLyrics ekibi tarafından tanımlanır.{" "}
            <Link href="/iletisim" className="font-semibold underline">
              Ekiple iletişime geç
            </Link>
          </Alert>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {codes.map((c) => {
              const availability = codeAvailability({ ...c, partnerActive: partner.active });
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xl font-extrabold text-ink">{c.code}</p>
                    {availability.ok ? <Badge tone="success">Geçerli</Badge> : <Badge>{availability.reason}</Badge>}
                  </div>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Müşteri indirimi</dt>
                      <dd className="font-semibold text-ink">{c.discountType === "PERCENT" ? bpsLabel(c.discountValue) : formatMoney(c.discountValue)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">{c.packageRates.length ? "Komisyon oranın (genel)" : "Komisyon oranın"}</dt>
                      <dd className="font-semibold text-ink">{bpsLabel(c.commissionRateBps)}</dd>
                    </div>
                    {[...c.packageRates]
                      .sort((a, b) => a.package.sortOrder - b.package.sortOrder)
                      .map((r) => (
                        <div key={r.package.name} className="flex justify-between gap-3">
                          <dt className="text-muted">{r.package.name}</dt>
                          <dd className="font-semibold text-ink">{bpsLabel(r.commissionRateBps)}</dd>
                        </div>
                      ))}
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Kullanım</dt>
                      <dd className="font-semibold text-ink">
                        {c.usageCount}
                        {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Geçerlilik</dt>
                      <dd className="text-ink">
                        {c.startsAt ? formatDate(c.startsAt) : "—"} – {c.endsAt ? formatDate(c.endsAt) : "süresiz"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Paketler</dt>
                      <dd className="text-ink">{c.packages.length ? c.packages.map((p) => p.name).join(", ") : "Tümü"}</dd>
                    </div>
                  </dl>
                  {availability.ok && (
                    <div className="mt-4 space-y-2 border-t border-line pt-4">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <Share2 className="size-4 text-brand" aria-hidden /> Takipçilerinle paylaş
                      </p>
                      <p className="text-xs text-muted">Bağlantıyla gelen müşterinin kodu sipariş özetinde otomatik doldurulur; satış sana atfedilir.</p>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={appUrl(referralSharePath(c.code))}
                          aria-label={`${c.code} paylaşım bağlantısı`}
                          className="h-9 min-w-0 flex-1 rounded-lg bg-canvas px-3 text-xs text-ink-soft ring-1 ring-line"
                        />
                        <CopyButton text={appUrl(referralSharePath(c.code))} label="Bağlantıyı kopyala" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <CopyButton text={c.code} label="Kodu kopyala" />
                        <CopyButton
                          text={`AddLyrics'te ${c.code} koduyla${c.discountType === "PERCENT" && c.discountValue > 0 ? ` ${bpsLabel(c.discountValue)}` : ""} indirim: ${appUrl(referralSharePath(c.code))}`}
                          label="Paylaşım metnini kopyala"
                        />
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Atfedilen siparişler</h2>
        <div className="relative overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Sipariş</th>
                <th className="px-4 py-3">Müşteri</th>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Kod</th>
                <th className="px-4 py-3">Komisyon</th>
                <th className="px-4 py-3">Durum</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    {c.order.number}
                    <div className="text-xs text-muted">{formatDate(c.order.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3">{c.order.customer}</td>
                  <td className="px-4 py-3">{c.order.packageName}</td>
                  <td className="px-4 py-3 font-mono">{c.referralCode.code}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(c.amountKurus)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={c.status === "PAID" ? "success" : c.status === "CANCELLED" ? "neutral" : c.status === "APPROVED" ? "brand" : "warning"}>{COMMISSION_STATUS_LABEL[c.status]}</Badge>
                    {c.payment.status === "REFUNDED" && <Badge tone="danger" className="ml-1">İade</Badge>}
                    {c.status === "PENDING" && c.payment.status === "SUCCEEDED" && (
                      <div className="mt-1 text-xs text-muted">Onaya uygun: {formatDate(c.eligibleAt)}</div>
                    )}
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Henüz kodunla ödemesi doğrulanmış bir satış yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Komisyon ödemelerin</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-muted">Henüz ödeme yapılmadı.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                <span>{formatDate(p.paidAt)}</span>
                <span className="font-semibold text-ink">{formatMoney(p.amountKurus)}</span>
                <span className="text-muted">
                  {p.method}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
