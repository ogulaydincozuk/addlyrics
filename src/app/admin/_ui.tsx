import type { ReactNode } from "react";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

/** Yönetim sayfası iskeleti. İçerik, yetki kontrolü yapan sunucu bileşeni olarak Suspense içinde akar. */
export function AdminPage({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </div>
  );
}

/** Müşteri listesinde bu müşteriyi bulan bağlantı (e-postayla arama). */
export function customerHref(email: string) {
  return `/admin/musteriler?q=${encodeURIComponent(email)}`;
}

/** Müşterinin tüm siparişleri (sipariş aramasında e-posta da aranır). */
export function customerOrdersHref(email: string) {
  return `/admin/siparisler?q=${encodeURIComponent(email)}`;
}

export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-line bg-canvas px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-4 py-3 align-top", className)}>{children}</td>;
}

export function Section({ title, description, actions, children, className }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
