import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { OrderStatusBadge } from "@/components/order/status-badge";
import { messages } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { ORDER_STATUSES, type OrderStatusValue } from "@/lib/enums";
import { formatMoney } from "@/lib/money";
import { ACTIVE_STATUSES } from "@/lib/order-status";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { AdminPage, customerHref, Table, Td, Th } from "../_ui";

export const metadata: Metadata = { title: "Siparişler" };

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/siparisler">) {
  return (
    <AdminPage title="Siparişler" description="Tüm siparişler, durumları ve atanan editörler.">
      <Orders searchParams={searchParams} />
    </AdminPage>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/admin/siparisler">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const t = messages();
  const durum = typeof sp.durum === "string" && (ORDER_STATUSES as readonly string[]).includes(sp.durum) ? (sp.durum as OrderStatusValue) : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const overdue = sp.gecikmis === "1";
  const active = sp.aktif === "1";

  const where: Prisma.OrderWhereInput = {
    ...(durum ? { status: durum } : {}),
    ...(active ? { status: { in: ACTIVE_STATUSES } } : {}),
    ...(overdue ? { dueDate: { lt: new Date() }, status: { in: ACTIVE_STATUSES } } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { song: { title: { contains: q, mode: "insensitive" } } },
            { song: { artistName: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [orders, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        song: { select: { artistName: true, title: true } },
        user: { select: { name: true, email: true } },
        assignments: { where: { active: true }, include: { editor: { select: { name: true } } } },
      },
    }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  // Sekmeler arama metnini korur
  const withQ = (params: string) => {
    const search = new URLSearchParams(params);
    if (q) search.set("q", q);
    const s = search.toString();
    return s ? `/admin/siparisler?${s}` : "/admin/siparisler";
  };
  const tabs = [
    { label: "Tümü", href: withQ(""), on: !durum && !overdue && !active },
    { label: "Üretimde", href: withQ("aktif=1"), on: active },
    ...ORDER_STATUSES.map((s) => ({ label: `${t.enums.orderStatus[s]} (${countOf(s)})`, href: withQ(`durum=${s}`), on: durum === s })),
    { label: "Gecikenler", href: withQ("gecikmis=1"), on: overdue },
  ];

  return (
    <div className="space-y-4">
      <form className="relative max-w-md" role="search">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          name="q"
          defaultValue={q}
          placeholder="Sipariş no, şarkı, sanatçı veya müşteri ara"
          className="h-11 w-full rounded-xl border border-line bg-card pl-10 pr-3 text-sm focus:border-brand focus:outline-none focus:shadow-[var(--shadow-focus)]"
          aria-label="Siparişlerde ara"
        />
        {durum && <input type="hidden" name="durum" value={durum} />}
        {active && <input type="hidden" name="aktif" value="1" />}
        {overdue && <input type="hidden" name="gecikmis" value="1" />}
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

      <Table minWidth={900}>
        <thead>
          <tr>
            <Th>Sipariş</Th>
            <Th>Şarkı</Th>
            <Th>Müşteri</Th>
            <Th>Video</Th>
            <Th>Editör</Th>
            <Th>Durum</Th>
            <Th>Teslim</Th>
            <Th>Tutar</Th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const late = o.dueDate && o.dueDate < new Date() && ACTIVE_STATUSES.includes(o.status);
            return (
              <tr key={o.id} className="hover:bg-canvas">
                <Td>
                  <Link href={`/admin/siparisler/${o.number}`} className="font-semibold text-brand hover:underline">
                    {o.number}
                  </Link>
                  <p className="text-xs text-muted">{formatDate(o.createdAt)}</p>
                </Td>
                <Td>
                  <p className="font-medium text-ink">{o.song.title}</p>
                  <p className="text-xs text-muted">
                    {o.song.artistName} · {t.enums.videoStyleShort[o.style]}
                  </p>
                </Td>
                <Td>
                  <Link href={customerHref(o.user.email)} className="text-ink hover:text-brand hover:underline">
                    {o.user.name}
                  </Link>
                  <p className="text-xs text-muted">{o.user.email}</p>
                </Td>
                <Td>{o.videoCount}</Td>
                <Td>{o.assignments[0]?.editor.name ?? <span className="text-muted">—</span>}</Td>
                <Td>
                  <OrderStatusBadge status={o.status} />
                </Td>
                <Td className={late ? "font-semibold text-danger" : "text-muted"}>{o.dueDate ? formatDate(o.dueDate) : "—"}</Td>
                <Td className="whitespace-nowrap">{o.kind === "PURCHASE" ? formatMoney(o.priceKurus, o.currency) : <span className="text-muted">Paket hakkı</span>}</Td>
              </tr>
            );
          })}
          {orders.length === 0 && (
            <tr>
              <Td className="text-muted">Bu filtreye uyan sipariş yok.</Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
