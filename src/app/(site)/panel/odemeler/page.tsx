import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { PaymentStatusBadge } from "@/components/order/status-badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { PackageSnapshot } from "@/lib/packages";
import { requireUser } from "@/server/auth/guards";
import { getPayments } from "@/server/queries/customer";
import { PanelPage } from "../_components";

export const metadata: Metadata = { title: "Ödeme Geçmişi" };

export default function PaymentsPage() {
  return (
    <PanelPage title="Ödeme Geçmişi" description="Tüm ödeme denemelerin. Kart bilgilerin AddLyrics tarafından saklanmaz.">
      <Payments />
    </PanelPage>
  );
}

async function Payments() {
  const user = await requireUser("/panel/odemeler");
  const list = await getPayments(user.id);
  const t = messages();
  if (!list.length) {
    return (
      <EmptyState
        icon={<CreditCard className="size-6" />}
        title="Henüz ödeme yok"
        description="Bir paket satın aldığında ödemelerin burada listelenir."
        action={<LinkButton href="/paketler">Paketleri İncele</LinkButton>}
      />
    );
  }
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Tarih</th>
            <th className="px-4 py-3 font-semibold">Sipariş</th>
            <th className="px-4 py-3 font-semibold">Paket</th>
            <th className="px-4 py-3 font-semibold">Tutar</th>
            <th className="px-4 py-3 font-semibold">Yöntem</th>
            <th className="px-4 py-3 font-semibold">Durum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 text-muted">{formatDateTime(p.createdAt)}</td>
              <td className="px-4 py-3">
                <Link href={`/panel/siparislerim/${p.order.number}`} className="font-medium text-brand hover:underline">
                  {p.order.number}
                </Link>
              </td>
              <td className="px-4 py-3 text-ink-soft">{(p.order.packageSnapshot as unknown as PackageSnapshot).name}</td>
              <td className="px-4 py-3 font-semibold text-ink">{formatMoney(p.amountKurus, p.currency)}</td>
              <td className="px-4 py-3 text-ink-soft">{t.enums.paymentProvider[p.provider]}</td>
              <td className="px-4 py-3">
                <PaymentStatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
