import type { Metadata } from "next";
import Link from "next/link";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { PaymentStatusBadge } from "@/components/order/status-badge";
import { Alert } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { AdminPage, customerHref, Table, Td, Th } from "../_ui";

export const metadata: Metadata = { title: "Ödemeler" };

const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED"];

export default function PaymentsAdminPage({ searchParams }: PageProps<"/admin/odemeler">) {
  return (
    <AdminPage title="Ödemeler" description="Tüm ödeme denemeleri ve sağlayıcı bildirimleri. Kart bilgisi saklanmaz.">
      <Payments searchParams={searchParams} />
    </AdminPage>
  );
}

async function Payments({ searchParams }: Pick<PageProps<"/admin/odemeler">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const t = messages();
  const durum = typeof sp.durum === "string" && (PAYMENT_STATUSES as string[]).includes(sp.durum) ? (sp.durum as PaymentStatus) : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const where: Prisma.PaymentWhereInput = {
    ...(durum ? { status: durum } : {}),
    ...(q
      ? {
          OR: [
            { order: { number: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { providerPaymentId: { contains: q, mode: "insensitive" } },
            { providerReference: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [payments, counts, failedWebhooks] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { order: { select: { number: true } }, user: { select: { name: true, email: true } } },
    }),
    db.payment.groupBy({ by: ["status"], _count: { _all: true } }),
    db.webhookEvent.findMany({ where: { processedAt: null, error: { not: null } }, orderBy: { receivedAt: "desc" }, take: 10 }),
  ]);
  const countOf = (s: PaymentStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  // Sekmeler arama metnini korur
  const withQ = (params: string) => {
    const search = new URLSearchParams(params);
    if (q) search.set("q", q);
    const s = search.toString();
    return s ? `/admin/odemeler?${s}` : "/admin/odemeler";
  };
  const tabs = [
    { label: "Tümü", href: withQ(""), on: !durum },
    ...PAYMENT_STATUSES.map((s) => ({ label: `${t.enums.paymentStatus[s]} (${countOf(s)})`, href: withQ(`durum=${s}`), on: durum === s })),
  ];

  return (
    <div className="space-y-4">
      {failedWebhooks.length > 0 && (
        <Alert tone="warning" title={`${failedWebhooks.length} işlenemeyen ödeme bildirimi`}>
          {failedWebhooks.map((w) => (
            <p key={w.id} className="text-xs">
              {formatDateTime(w.receivedAt)} · {w.provider} · {w.topic ?? "—"} · {w.error}
            </p>
          ))}
        </Alert>
      )}
      <form className="relative max-w-md" role="search">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          name="q"
          defaultValue={q}
          placeholder="Sipariş no, müşteri e-postası veya sağlayıcı referansı ara"
          className="h-11 w-full rounded-xl border border-line bg-card pl-10 pr-3 text-sm focus:border-brand focus:outline-none focus:shadow-[var(--shadow-focus)]"
          aria-label="Ödemelerde ara"
        />
        {durum && <input type="hidden" name="durum" value={durum} />}
      </form>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold",
              tab.on ? "bg-ink text-white" : "bg-card text-ink-soft ring-1 ring-line hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <Table minWidth={920}>
        <thead>
          <tr>
            <Th>Tarih</Th>
            <Th>Sipariş</Th>
            <Th>Müşteri</Th>
            <Th>Tutar</Th>
            <Th>Sağlayıcı</Th>
            <Th>Referans</Th>
            <Th>Durum</Th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="hover:bg-canvas">
              <Td className="whitespace-nowrap text-muted">{formatDateTime(p.createdAt)}</Td>
              <Td>
                <Link href={`/admin/siparisler/${p.order.number}`} className="font-semibold text-brand hover:underline">
                  {p.order.number}
                </Link>
              </Td>
              <Td>
                <Link href={customerHref(p.user.email)} className="text-ink hover:text-brand hover:underline">
                  {p.user.name}
                </Link>
                <p className="text-xs text-muted">{p.user.email}</p>
              </Td>
              <Td className="whitespace-nowrap font-semibold">{formatMoney(p.amountKurus, p.currency)}</Td>
              <Td>{t.enums.paymentProvider[p.provider]}</Td>
              <Td className="max-w-48 break-all text-xs text-muted">
                {p.providerPaymentId ?? "—"}
                {p.providerReference && <span className="block">{p.providerReference}</span>}
                {p.failureReason && <span className="block text-danger">{p.failureReason}</span>}
              </Td>
              <Td>
                <PaymentStatusBadge status={p.status} />
              </Td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr>
              <Td className="text-muted">{q || durum ? "Bu filtreye uyan ödeme yok." : "Henüz ödeme yok."}</Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
