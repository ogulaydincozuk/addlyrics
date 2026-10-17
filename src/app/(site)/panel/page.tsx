import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CreditCard, Film, ListMusic, PlusCircle, UploadCloud } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, EmptyState } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { ACTIVE_STATUSES } from "@/lib/order-status";
import { requireUser } from "@/server/auth/guards";
import { getEntitlements, getNotifications, getOrders } from "@/server/queries/customer";
import { db } from "@/server/db";
import { markNotificationsRead } from "./actions";
import { EntitlementCard, entitlementState, OrderRow, PanelPage } from "./_components";

export const metadata: Metadata = { title: "Genel Bakış" };

export default function PanelHome() {
  return (
    <PanelPage title="Genel Bakış" description="Paketlerin, siparişlerin ve teslimlerin tek bakışta.">
      <Overview />
    </PanelPage>
  );
}

async function Overview() {
  const user = await requireUser("/panel");
  const [entitlements, orders, notifications, deliveredCount] = await Promise.all([
    getEntitlements(user.id),
    getOrders(user.id),
    getNotifications(user.id),
    db.deliverable.count({ where: { releasedAt: { not: null }, order: { userId: user.id } } }),
  ]);

  const usable = entitlements.filter((e) => entitlementState(e).usable);
  const remaining = usable.reduce((sum, e) => sum + entitlementState(e).remaining, 0);
  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const needsPayment = orders.filter((o) => o.status === "PAYMENT_PENDING");
  const needsFiles = orders.filter((o) => o.status === "AWAITING_FILES");
  const unread = notifications.filter((n) => !n.readAt).length;

  const stats = [
    { label: "Kalan video hakkı", value: remaining, icon: Film },
    { label: "Aktif paket", value: usable.length, icon: CreditCard },
    { label: "Devam eden sipariş", value: activeOrders.length, icon: ListMusic },
    { label: "Teslim edilen video", value: deliveredCount, icon: UploadCloud },
  ];

  return (
    <div className="space-y-8">
      <p className="text-lg text-ink">
        Merhaba <strong>{user.artistName || user.name}</strong> 👋
      </p>

      {(needsPayment.length > 0 || needsFiles.length > 0) && (
        <div className="space-y-3">
          {needsPayment.map((o) => (
            <Alert key={o.id} tone="warning" title={`${o.number}: ödeme bekleniyor`}>
              Ödemeni tamamladığında paketin aktifleşir.{" "}
              <Link href={`/siparis/${o.number}/odeme`} className="font-semibold underline">
                Ödemeyi tamamla
              </Link>
            </Alert>
          ))}
          {needsFiles.map((o) => (
            <Alert key={o.id} tone="warning" title={`${o.number}: dosya bekleniyor`}>
              {o.song.artistName} – {o.song.title} için üretime başlayabilmemiz gereken dosyalar eksik.{" "}
              <Link href={`/panel/siparislerim/${o.number}`} className="font-semibold underline">
                Dosyaları yükle
              </Link>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 sm:p-5">
            <s.icon className="size-5 text-brand" aria-hidden />
            <p className="mt-3 font-display text-2xl font-extrabold text-ink">{s.value}</p>
            <p className="text-xs font-medium text-muted sm:text-sm">{s.label}</p>
          </Card>
        ))}
      </div>

      <section aria-labelledby="aktif-paketler">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="aktif-paketler" className="text-lg font-bold text-ink">
            Paketlerim
          </h2>
          <Link href="/panel/paketlerim" className="text-sm font-semibold text-brand hover:underline">
            Tümü
          </Link>
        </div>
        {usable.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {usable.slice(0, 2).map((e) => (
              <EntitlementCard
                key={e.id}
                e={e}
                action={
                  <LinkButton href={`/panel/yeni-siparis?hak=${e.id}`} size="sm" icon={<PlusCircle className="size-4" aria-hidden />}>
                    Yeni Şarkı Gönder
                  </LinkButton>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CreditCard className="size-6" />}
            title="Aktif paketin yok"
            description="Bir paket satın aldığında video hakların burada görünür."
            action={<LinkButton href="/paketler">Paketleri İncele</LinkButton>}
          />
        )}
      </section>

      <section aria-labelledby="son-siparisler">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="son-siparisler" className="text-lg font-bold text-ink">
            Son siparişler
          </h2>
          <Link href="/panel/siparislerim" className="text-sm font-semibold text-brand hover:underline">
            Tümü
          </Link>
        </div>
        {orders.length ? (
          <div className="space-y-3">
            {orders.slice(0, 4).map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong bg-card p-6 text-center text-sm text-muted">Henüz siparişin yok.</p>
        )}
      </section>

      <section aria-labelledby="bildirimler">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="bildirimler" className="flex items-center gap-2 text-lg font-bold text-ink">
            <Bell className="size-5 text-brand" aria-hidden /> Bildirimler
            {unread > 0 && <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-bold text-ink">{unread}</span>}
          </h2>
          {unread > 0 && (
            <form action={markNotificationsRead}>
              <button type="submit" className="text-sm font-semibold text-brand hover:underline">
                Tümünü okundu işaretle
              </button>
            </form>
          )}
        </div>
        {notifications.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {notifications.map((n) => (
              <li key={n.id} className="flex gap-3 px-4 py-3.5">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-line-strong" : "bg-brand"}`} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Henüz bildirimin yok.</p>
        )}
      </section>
    </div>
  );
}
