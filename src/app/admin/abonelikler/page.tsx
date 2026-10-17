import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { AdminPage, Table, Td, Th } from "../_ui";

export const metadata: Metadata = { title: "Abonelikler ve Video Hakları" };

export default function SubscriptionsPage() {
  return (
    <AdminPage
      title="Abonelikler ve Video Hakları"
      description="Doğrulanmış ödemelerden doğan paket dönemleri. Haklar tek seferlik ödemeyle başlar; otomatik yenileme yoktur, iadede hak kapatılır."
    >
      <Subscriptions />
    </AdminPage>
  );
}

async function Subscriptions() {
  await requireAdmin();
  const now = new Date();
  const entitlements = await db.packageEntitlement.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      package: { select: { name: true } },
      payment: { select: { status: true, amountKurus: true, currency: true } },
      sourceOrder: { select: { number: true, trialApplicationId: true } },
      // Hakların kullanım dökümü: her video bir proje kaydıdır
      orders: { select: { number: true, kind: true, videoCount: true, createdAt: true, _count: { select: { projects: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <Table minWidth={1100}>
      <thead>
        <tr>
          <Th>Müşteri</Th>
          <Th>Paket</Th>
          <Th>Dönem</Th>
          <Th>Durum</Th>
          <Th>Haklar</Th>
          <Th>Kullanım dökümü</Th>
          <Th>Ödeme</Th>
        </tr>
      </thead>
      <tbody>
        {entitlements.map((e) => {
          const expired = e.endsAt <= now;
          const projectTotal = e.orders.reduce((n, o) => n + o._count.projects, 0);
          const consistent = projectTotal === e.usedVideos;
          return (
            <tr key={e.id}>
              <Td>
                <div className="font-medium text-ink">{e.user.name}</div>
                <div className="text-xs text-muted">{e.user.email}</div>
              </Td>
              <Td>
                {e.package.name}
                {e.sourceOrder.trialApplicationId && <Badge className="ml-1">denemeden</Badge>}
              </Td>
              <Td>
                {formatDate(e.startsAt)} – {formatDate(e.endsAt)}
              </Td>
              <Td>
                {e.status === "REVOKED" ? (
                  <Badge tone="danger">İptal (iade)</Badge>
                ) : expired ? (
                  <Badge>Süresi doldu</Badge>
                ) : (
                  <Badge tone="success">Aktif</Badge>
                )}
              </Td>
              <Td>
                <span className="font-semibold text-ink">{e.usedVideos}</span> / {e.totalVideos} kullanıldı
                <div className="text-xs text-muted">Kalan: {Math.max(0, e.totalVideos - e.usedVideos)}</div>
                {!consistent && <Badge tone="danger">Döküm uyuşmuyor ({projectTotal})</Badge>}
              </Td>
              <Td>
                <ul className="space-y-1 text-xs">
                  {e.orders.map((o) => (
                    <li key={o.number}>
                      <Link href={`/admin/siparisler/${o.number}`} className="text-brand hover:underline">
                        {o.number}
                      </Link>{" "}
                      · {o._count.projects} video · {formatDate(o.createdAt)}
                    </li>
                  ))}
                </ul>
              </Td>
              <Td>
                {formatMoney(e.payment.amountKurus, e.payment.currency)}
                <div className="text-xs text-muted">{e.payment.status}</div>
              </Td>
            </tr>
          );
        })}
        {entitlements.length === 0 && (
          <tr>
            <Td className="py-8 text-muted">Henüz paket hakkı yok.</Td>
          </tr>
        )}
      </tbody>
    </Table>
  );
}
