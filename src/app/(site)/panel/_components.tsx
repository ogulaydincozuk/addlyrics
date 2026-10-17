import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Check, ChevronRight } from "lucide-react";
import { deliverySchedule } from "@/lib/delivery-plan";
import type { PackageSnapshot } from "@/lib/packages";
import { OrderProgress } from "@/components/order/order-progress";
import { OrderStatusBadge } from "@/components/order/status-badge";
import { Badge, Card, PageSkeleton } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import type { OrderStatusValue } from "@/lib/enums";

export function PanelPage({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink sm:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </div>
  );
}

export function entitlementState(e: { status: string; startsAt: Date; endsAt: Date; totalVideos: number; usedVideos: number }, now = new Date()) {
  const remaining = Math.max(0, e.totalVideos - e.usedVideos);
  if (e.status === "REVOKED") return { label: "İptal edildi", tone: "danger" as const, usable: false, remaining };
  if (e.endsAt <= now) return { label: "Süresi doldu", tone: "neutral" as const, usable: false, remaining };
  if (remaining === 0) return { label: "Haklar kullanıldı", tone: "neutral" as const, usable: false, remaining };
  return { label: "Aktif", tone: "success" as const, usable: true, remaining };
}

export function EntitlementCard({
  e,
  action,
}: {
  e: {
    id: string;
    status: string;
    startsAt: Date;
    endsAt: Date;
    totalVideos: number;
    usedVideos: number;
    package: { name: string };
    sourceOrder: { number: string; packageSnapshot?: unknown };
  };
  action?: ReactNode;
}) {
  const state = entitlementState(e);
  const pct = e.totalVideos ? Math.round((e.usedVideos / e.totalVideos) * 100) : 0;
  const snap = e.sourceOrder.packageSnapshot as PackageSnapshot | undefined;
  const schedule = snap ? deliverySchedule(e.startsAt, snap.videoCount, snap.bonusVideoCount ?? 0, snap.durationMonths) : [];
  const now = new Date();
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-ink">{e.package.name}</p>
          <p className="mt-0.5 text-sm text-muted">
            {formatDate(e.startsAt)} – {formatDate(e.endsAt)} · Sipariş{" "}
            <Link href={`/panel/siparislerim/${e.sourceOrder.number}`} className="font-medium text-brand hover:underline">
              {e.sourceOrder.number}
            </Link>
          </p>
        </div>
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
        {[
          ["Toplam", e.totalVideos],
          ["Kullanılan", e.usedVideos],
          ["Kalan", state.remaining],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-xl bg-canvas py-3 ring-1 ring-line">
            <dt className="text-xs font-medium text-muted">{k}</dt>
            <dd className="font-display text-xl font-extrabold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Kullanılan video hakkı">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      {schedule.length > 0 && e.status !== "REVOKED" && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Teslim takvimi</p>
          <ol className="mt-2 grid gap-2 sm:grid-cols-3">
            {schedule.map((b) => {
              const past = b.date <= now;
              return (
                <li key={b.month} className={`rounded-xl px-3 py-2.5 text-sm ring-1 ${past ? "bg-canvas text-muted ring-line" : "bg-brand-tint text-brand-ink ring-brand-soft"}`}>
                  <span className="flex items-center gap-1 font-semibold">
                    {past && <Check className="size-3.5" aria-hidden />}
                    {formatDate(b.date)}
                  </span>
                  <span className="text-xs">
                    {b.videos} video{b.bonus > 0 ? ` (${b.bonus} bonus)` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {action && state.usable && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export function OrderRow({
  order,
}: {
  order: { number: string; status: OrderStatusValue; createdAt: Date; videoCount: number; song: { artistName: string; title: string }; dueDate?: Date | null };
}) {
  return (
    <Link
      href={`/panel/siparislerim/${order.number}`}
      className="group block rounded-2xl border border-line bg-card p-4 transition-shadow hover:shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">
            {order.song.artistName} – {order.song.title}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {order.number} · {formatDate(order.createdAt)} · {order.videoCount} video
            {order.dueDate ? ` · Planlanan teslim: ${formatDate(order.dueDate)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>
      </div>
      <div className="mt-4">
        <OrderProgress status={order.status} compact />
      </div>
    </Link>
  );
}
