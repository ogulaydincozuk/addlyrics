import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { OrderStatusBadge } from "@/components/order/status-badge";
import { Card } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ACTIVE_STATUSES } from "@/lib/order-status";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getReadiness } from "@/server/readiness";
import { AdminPage, Section, Table, Td, Th } from "./_ui";

export const metadata: Metadata = { title: "Gösterge Paneli" };

export default function AdminDashboardPage() {
  return (
    <AdminPage title="Gösterge Paneli" description="Siparişler, editör iş yükü ve satışa hazırlık durumu.">
      <Dashboard />
    </AdminPage>
  );
}

async function Dashboard() {
  const admin = await requireAdmin();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [trialChecks, trialLate, trialReady, trialConverted, commissionPending] = await Promise.all([
    db.trialApplication.count({ where: { status: { in: ["RECEIVED", "FILES_CHECK"] } } }),
    db.trialApplication.count({ where: { previewDueAt: { lt: now }, status: { in: ["QUEUED", "IN_PRODUCTION", "FAILED"] } } }),
    db.trialApplication.count({ where: { previewsReadyAt: { not: null } } }),
    db.trialApplication.count({ where: { convertedOrderId: { not: null } } }),
    db.commission.aggregate({ where: { status: { in: ["PENDING", "APPROVED"] } }, _sum: { amountKurus: true } }),
  ]);
  const [byStatus, overdue, revenue, activeEntitlements, customers, recent, alerts, readiness, workload] = await Promise.all([
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.count({ where: { dueDate: { lt: now }, status: { in: ACTIVE_STATUSES } } }),
    db.payment.aggregate({ where: { status: "SUCCEEDED", paidAt: { gte: monthStart }, provider: { not: "MOCK" } }, _sum: { amountKurus: true } }),
    db.packageEntitlement.count({ where: { status: "ACTIVE", endsAt: { gt: now } } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.order.findMany({
      where: { status: { not: "PAYMENT_PENDING" } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { song: { select: { artistName: true, title: true } }, user: { select: { name: true } } },
    }),
    db.notification.findMany({ where: { userId: admin.id, type: "ADMIN_ALERT" }, orderBy: { createdAt: "desc" }, take: 6 }),
    getReadiness(),
    db.editor.findMany({
      where: { active: true },
      include: { _count: { select: { assignments: { where: { active: true, order: { status: { in: ACTIVE_STATUSES } } } } } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const attention = [
    { label: "Yeni sipariş", value: count("NEW"), href: "/admin/siparisler?durum=NEW" },
    { label: "Dosya bekleniyor", value: count("AWAITING_FILES"), href: "/admin/siparisler?durum=AWAITING_FILES" },
    { label: "Teslime hazır", value: count("READY_FOR_DELIVERY"), href: "/admin/siparisler?durum=READY_FOR_DELIVERY" },
    { label: "Teslim tarihi geçmiş", value: overdue, href: "/admin/siparisler?gecikmis=1" },
    { label: "Deneme: dosya kontrolü", value: trialChecks, href: "/admin/denemeler?durum=FILES_CHECK" },
    { label: "Deneme: hedefi geçen", value: trialLate, href: "/admin/denemeler?gecikmis=1" },
    { label: "Deneme → satın alma", value: trialConverted, href: "/admin/denemeler?durum=COMPLETED", note: trialReady ? `Ön izlemesi hazırlanan ${trialReady} denemeden` : undefined },
    { label: "Ödenmemiş komisyon (TL)", value: Math.round((commissionPending._sum.amountKurus ?? 0) / 100), href: "/admin/komisyonlar" },
  ];
  const readyCount = readiness.filter((r) => r.ok).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {attention.map((a) => (
          <Link key={a.label} href={a.href} className="rounded-2xl border border-line bg-card p-4 transition-shadow hover:shadow-[var(--shadow-card)]">
            <p className="text-sm text-muted">{a.label}</p>
            <p className={`mt-1 font-display text-3xl font-extrabold ${a.value > 0 ? "text-ink" : "text-slate-300"}`}>{a.value}</p>
            {"note" in a && a.note && <p className="text-xs text-muted">{a.note}</p>}
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted">Bu ay tahsilat</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink">{formatMoney(revenue._sum.amountKurus ?? 0)}</p>
          <p className="text-xs text-muted">Test ödemeleri hariç</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Aktif paket</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink">{activeEntitlements}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Üretimdeki sipariş</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink">{ACTIVE_STATUSES.reduce((n, s) => n + count(s), 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Müşteri</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink">{customers}</p>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section
          title="Son hareketler"
          actions={
            <Link href="/admin/siparisler" className="text-sm font-semibold text-brand hover:underline">
              Tüm siparişler
            </Link>
          }
        >
          <Table minWidth={620}>
            <thead>
              <tr>
                <Th>Sipariş</Th>
                <Th>Şarkı / Müşteri</Th>
                <Th>Durum</Th>
                <Th>Teslim</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="hover:bg-canvas">
                  <Td>
                    <Link href={`/admin/siparisler/${o.number}`} className="font-semibold text-brand hover:underline">
                      {o.number}
                    </Link>
                  </Td>
                  <Td>
                    <p className="font-medium text-ink">
                      {o.song.artistName} – {o.song.title}
                    </p>
                    <p className="text-xs text-muted">{o.user.name}</p>
                  </Td>
                  <Td>
                    <OrderStatusBadge status={o.status} />
                  </Td>
                  <Td className="text-muted">{o.dueDate ? formatDate(o.dueDate) : "—"}</Td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <Td className="text-muted">Henüz sipariş yok.</Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Section>

        <Section title={`Satışa hazırlık (${readyCount}/${readiness.length})`} description="Gerçek satışa başlamadan önce tamamlanması gerekenler.">
          <ul className="space-y-2.5">
            {readiness.map((r) => (
              <li key={r.key} className="flex gap-3">
                {r.ok ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Tamam" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-label="Eksik" />
                )}
                <div className="min-w-0 text-sm">
                  {r.href ? (
                    <Link href={r.href} className="font-semibold text-ink hover:text-brand">
                      {r.label}
                    </Link>
                  ) : (
                    <p className="font-semibold text-ink">{r.label}</p>
                  )}
                  <p className="text-muted">{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <Section title="Editör iş yükü" description="Aktif (teslim edilmemiş) atamalar.">
          {workload.length ? (
            <ul className="divide-y divide-line">
              {workload.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-ink">{e.name}</span>
                  <span className="text-muted">{e._count.assignments} sipariş</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Aktif editör yok.{" "}
              <Link href="/admin/editorler" className="font-semibold text-brand hover:underline">
                Editör ekle
              </Link>
            </p>
          )}
        </Section>
        <Section title="Ekip bildirimleri">
          {alerts.length ? (
            <ul className="space-y-3">
              {alerts.map((n) => (
                <li key={n.id} className="text-sm">
                  <p className="font-semibold text-ink">{n.title}</p>
                  <p className="text-muted">{n.body}</p>
                  <p className="text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Bildirim yok.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
