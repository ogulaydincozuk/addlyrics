import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { AdminPage, customerOrdersHref, Table, Td, Th } from "../_ui";

export const metadata: Metadata = { title: "Müşteriler" };

export default function CustomersPage({ searchParams }: PageProps<"/admin/musteriler">) {
  return (
    <AdminPage title="Müşteriler" description="Kayıtlı müşteriler, paket hakları ve siparişleri.">
      <Customers searchParams={searchParams} />
    </AdminPage>
  );
}

async function Customers({ searchParams }: Pick<PageProps<"/admin/musteriler">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  // Telefon kayıtları E.164 biçiminde (+905…); "0532 …" gibi yazımlar da bulunsun
  const qPhone = /^[\d\s()+.\-]+$/.test(q) ? q.replace(/\D/g, "").replace(/^0+/, "") : "";
  const now = new Date();
  const users = await db.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { artistName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              ...(qPhone.length >= 4 ? [{ phone: { contains: qPhone } }] : []),
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      entitlements: { where: { status: "ACTIVE", endsAt: { gt: now } }, select: { totalVideos: true, usedVideos: true } },
      orders: { orderBy: { createdAt: "desc" }, take: 3, select: { number: true } },
      trialApplication: { select: { number: true } },
      _count: { select: { orders: true } },
    },
  });

  return (
    <div className="space-y-4">
      <form className="relative max-w-md" role="search">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          name="q"
          defaultValue={q}
          placeholder="Ad, sanatçı adı, e-posta veya telefon ara"
          aria-label="Müşterilerde ara"
          className="h-11 w-full rounded-xl border border-line bg-card pl-10 pr-3 text-sm focus:border-brand focus:outline-none focus:shadow-[var(--shadow-focus)]"
        />
      </form>
      <Table minWidth={760}>
        <thead>
          <tr>
            <Th>Müşteri</Th>
            <Th>Kayıt</Th>
            <Th>Aktif video hakkı</Th>
            <Th>Sipariş</Th>
            <Th>Son siparişler</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const remaining = u.entitlements.reduce((s, e) => s + (e.totalVideos - e.usedVideos), 0);
            return (
              <tr key={u.id} className="hover:bg-canvas">
                <Td>
                  <p className="font-medium text-ink">
                    {u.name}
                    {u.artistName && <span className="text-muted"> ({u.artistName})</span>}
                  </p>
                  <a href={`mailto:${u.email}`} className="text-xs text-brand hover:underline">
                    {u.email}
                  </a>
                  {u.phone && <p className="text-xs text-muted">{u.phone}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={u.emailVerifiedAt ? "success" : "warning"}>{u.emailVerifiedAt ? "E-posta doğrulandı" : "E-posta doğrulanmadı"}</Badge>
                    <Badge tone={u.phoneVerifiedAt ? "success" : "warning"}>{u.phoneVerifiedAt ? "Telefon doğrulandı" : "Telefon doğrulanmadı"}</Badge>
                    {u.trialApplication && (
                      <Link href={`/admin/denemeler/${u.trialApplication.number}`}>
                        <Badge tone="brand">Deneme {u.trialApplication.number}</Badge>
                      </Link>
                    )}
                  </div>
                </Td>
                <Td className="text-muted">{formatDate(u.createdAt)}</Td>
                <Td>{u.entitlements.length ? `${remaining} video (${u.entitlements.length} paket)` : <span className="text-muted">—</span>}</Td>
                <Td>{u._count.orders}</Td>
                <Td>
                  {u.orders.map((o) => (
                    <Link key={o.number} href={`/admin/siparisler/${o.number}`} className="mr-2 text-xs font-medium text-brand hover:underline">
                      {o.number}
                    </Link>
                  ))}
                  {u._count.orders > 0 && (
                    <Link href={customerOrdersHref(u.email)} className="mt-1 block text-xs font-semibold text-brand hover:underline">
                      Tüm siparişleri ({u._count.orders}) →
                    </Link>
                  )}
                </Td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <Td className="text-muted">Müşteri bulunamadı.</Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
