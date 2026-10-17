import type { Metadata } from "next";
import Link from "next/link";
import type { CommissionStatus, Prisma } from "@prisma/client";
import { OrderStatusBadge } from "@/components/order/status-badge";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { bpsLabel, COMMISSION_BASE_LABEL, COMMISSION_STATUS_LABEL } from "@/lib/referral";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../_forms";
import { AdminPage, customerHref, Table, Td, Th } from "../_ui";
import { approveCommissionAction, cancelCommissionAction } from "../is-ortaklari/actions";

export const metadata: Metadata = { title: "Satış ve Komisyonlar" };

const STATUSES: CommissionStatus[] = ["PENDING", "APPROVED", "PAID", "CANCELLED"];

export default function CommissionsPage({ searchParams }: PageProps<"/admin/komisyonlar">) {
  return (
    <AdminPage
      title="Satış ve Komisyon Raporu"
      description="Komisyon yalnızca doğrulanmış ödemeden doğar. İade/cayma süresi (Sistem Ayarları) dolmadan onaylanamaz; iade gelirse ödenmemiş komisyon iptal edilir, ödenmişse mahsup edilir."
    >
      <Commissions searchParams={searchParams} />
    </AdminPage>
  );
}

async function Commissions({ searchParams }: Pick<PageProps<"/admin/komisyonlar">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  // "Onaylanabilir": approveCommission ile aynı kural — bekleyen, iade/cayma süresi dolmuş, ödemesi geçerli
  const approvable = sp.onaylanabilir === "1";
  const status = !approvable && typeof sp.durum === "string" && (STATUSES as string[]).includes(sp.durum) ? (sp.durum as CommissionStatus) : null;
  const partnerId = typeof sp.ortak === "string" && sp.ortak ? sp.ortak : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const now = new Date();
  const approvableWhere: Prisma.CommissionWhereInput = { status: "PENDING", eligibleAt: { lte: now }, payment: { status: "SUCCEEDED" } };
  const where: Prisma.CommissionWhereInput = {
    ...(approvable ? approvableWhere : status ? { status } : {}),
    ...(partnerId ? { partnerId } : {}),
    ...(q
      ? {
          order: {
            OR: [
              { number: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } },
              { user: { name: { contains: q, mode: "insensitive" } } },
            ],
          },
        }
      : {}),
  };
  // Sekme bağlantıları iş ortağı filtresini ve arama metnini korur
  const href = (params: Record<string, string>) => {
    const search = new URLSearchParams(params);
    if (partnerId) search.set("ortak", partnerId);
    if (q) search.set("q", q);
    const s = search.toString();
    return s ? `/admin/komisyonlar?${s}` : "/admin/komisyonlar";
  };

  const [rows, totals, partners, pendingOrders, approvableCount] = await Promise.all([
    db.commission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        partner: { select: { id: true, name: true } },
        referralCode: { select: { id: true, code: true } },
        payment: { select: { status: true, amountKurus: true, refundedAt: true } },
        order: {
          select: {
            number: true,
            status: true,
            listPriceKurus: true,
            discountKurus: true,
            currency: true,
            user: { select: { name: true, email: true } },
            package: { select: { name: true } },
          },
        },
        payout: { select: { paidAt: true, reference: true } },
      },
    }),
    db.commission.groupBy({ by: ["status"], where: partnerId ? { partnerId } : {}, _sum: { amountKurus: true }, _count: { _all: true } }),
    db.partner.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Kodla oluşturulmuş ama henüz ödemesi doğrulanmamış siparişler (kazanılmış sayılmaz)
    db.order.count({ where: { referralCodeId: { not: null }, status: "PAYMENT_PENDING", ...(partnerId ? { partnerId } : {}) } }),
    db.commission.count({ where: { ...approvableWhere, ...(partnerId ? { partnerId } : {}) } }),
  ]);
  const total = (s: CommissionStatus) => totals.find((t) => t.status === s);
  const tabs = [
    { label: "Tümü", href: href({}), on: !status && !approvable },
    { label: `Onaylanabilir (${approvableCount})`, href: href({ onaylanabilir: "1" }), on: approvable },
    ...STATUSES.map((s) => ({ label: COMMISSION_STATUS_LABEL[s], href: href({ durum: s }), on: status === s })),
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {STATUSES.map((s) => (
          <div key={s} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{COMMISSION_STATUS_LABEL[s]}</p>
            <p className="mt-1 text-xl font-extrabold text-ink">{formatMoney(total(s)?._sum.amountKurus ?? 0)}</p>
            <p className="text-xs text-muted">{total(s)?._count._all ?? 0} kayıt</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Kodla açılmış, ödemesi beklenen sipariş: {pendingOrders} (komisyon doğmaz).</p>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold ring-1", t.on ? "bg-lime text-ink ring-[#c4e534]" : "bg-card text-ink-soft ring-line")}>
            {t.label}
          </Link>
        ))}
        <form className="ml-auto flex flex-wrap items-center gap-2" role="search">
          {status && <input type="hidden" name="durum" value={status} />}
          {approvable && <input type="hidden" name="onaylanabilir" value="1" />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Sipariş no veya müşteri e-postası"
            aria-label="Komisyonlarda ara"
            className="h-9 w-56 rounded-lg border border-line-strong bg-card px-2 text-sm"
          />
          <select name="ortak" defaultValue={partnerId ?? ""} className="h-9 rounded-lg border border-line-strong bg-card px-2 text-sm" aria-label="İş ortağı filtresi">
            <option value="">Tüm iş ortakları</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-white">
            Filtrele
          </button>
        </form>
      </div>

      <Table minWidth={1400}>
        <thead>
          <tr>
            <Th>Sipariş</Th>
            <Th>Müşteri</Th>
            <Th>Kod / iş ortağı</Th>
            <Th>Paket · liste</Th>
            <Th>İndirim</Th>
            <Th>Tahsilat</Th>
            <Th>Komisyon tabanı</Th>
            <Th>Oran</Th>
            <Th>Komisyon</Th>
            <Th>Ödeme / sipariş</Th>
            <Th>Komisyon durumu</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const refunded = c.payment.status === "REFUNDED";
            const canApprove = c.status === "PENDING" && c.eligibleAt <= now && c.payment.status === "SUCCEEDED";
            return (
              <tr key={c.id}>
                <Td>
                  <Link href={`/admin/siparisler/${c.order.number}`} className="font-semibold text-brand hover:underline">
                    {c.order.number}
                  </Link>
                  <div className="text-xs text-muted">{formatDate(c.createdAt)}</div>
                </Td>
                <Td>
                  <Link href={customerHref(c.order.user.email)} className="hover:text-brand hover:underline">
                    {c.order.user.name}
                  </Link>
                  <div className="text-xs text-muted">{c.order.user.email}</div>
                </Td>
                <Td>
                  <Link href={`/admin/referans-kodlari/${c.referralCode.id}`} aria-label={`${c.referralCode.code} kodunu aç`}>
                    <Badge tone="brand">{c.referralCode.code}</Badge>
                  </Link>
                  <div className="text-xs">
                    <Link href={`/admin/is-ortaklari/${c.partner.id}`} className="hover:underline">
                      {c.partner.name}
                    </Link>
                  </div>
                </Td>
                <Td>
                  {c.order.package.name}
                  <div className="text-xs text-muted">{formatMoney(c.order.listPriceKurus ?? 0, c.order.currency)}</div>
                </Td>
                <Td>{formatMoney(c.order.discountKurus, c.order.currency)}</Td>
                <Td>{formatMoney(c.payment.amountKurus, c.order.currency)}</Td>
                <Td>
                  {formatMoney(c.baseAmountKurus)}
                  <div className="text-xs text-muted">{COMMISSION_BASE_LABEL[c.baseType]}</div>
                </Td>
                <Td>{bpsLabel(c.rateBps)}</Td>
                <Td className="font-semibold">{formatMoney(c.amountKurus)}</Td>
                <Td className="text-xs">
                  {refunded ? <Badge tone="danger">İade edildi</Badge> : <Badge tone="success">Ödendi</Badge>}
                  <div className="mt-1">
                    <OrderStatusBadge status={c.order.status} />
                  </div>
                </Td>
                <Td>
                  <Badge tone={c.status === "PAID" ? "success" : c.status === "CANCELLED" ? "neutral" : c.status === "APPROVED" ? "brand" : "warning"}>{COMMISSION_STATUS_LABEL[c.status]}</Badge>
                  {c.clawbackAt && <Badge tone="danger" className="ml-1">Mahsup edilecek</Badge>}
                  {c.status === "PENDING" && <div className="mt-1 text-xs text-muted">Onaylanabilir: {formatDate(c.eligibleAt)}</div>}
                  {c.payout && <div className="mt-1 text-xs text-muted">Ödeme: {formatDate(c.payout.paidAt)} {c.payout.reference ?? ""}</div>}
                  {c.cancelReason && <div className="mt-1 text-xs text-muted">{c.cancelReason}</div>}
                  <div className="mt-2 space-y-2">
                    {canApprove && <ActionForm action={approveCommissionAction.bind(null, c.id)} submitLabel="Onayla" />}
                    {(c.status === "PENDING" || c.status === "APPROVED") && (
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-danger">İptal et</summary>
                        <ActionForm action={cancelCommissionAction.bind(null, c.id)} submitLabel="İptal et" variant="danger" className="mt-2">
                          <Input name="reason" placeholder="Gerekçe" aria-label="İptal gerekçesi" required />
                        </ActionForm>
                      </details>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <Td className="py-8 text-muted">Kayıt yok.</Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
