import type { Metadata } from "next";
import Link from "next/link";
import { PaymentStatusBadge } from "@/components/order/status-badge";
import { Alert } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { AdminPage, Table, Td, Th } from "../_ui";

export const metadata: Metadata = { title: "Ödemeler" };

export default function PaymentsAdminPage() {
  return (
    <AdminPage title="Ödemeler" description="Tüm ödeme denemeleri ve sağlayıcı bildirimleri. Kart bilgisi saklanmaz.">
      <Payments />
    </AdminPage>
  );
}

async function Payments() {
  await requireAdmin();
  const t = messages();
  const [payments, failedWebhooks] = await Promise.all([
    db.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { order: { select: { number: true } }, user: { select: { name: true, email: true } } },
    }),
    db.webhookEvent.findMany({ where: { processedAt: null, error: { not: null } }, orderBy: { receivedAt: "desc" }, take: 10 }),
  ]);
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
                <p className="text-ink">{p.user.name}</p>
                <p className="text-xs text-muted">{p.user.email}</p>
              </Td>
              <Td className="whitespace-nowrap font-semibold">{formatMoney(p.amountKurus, p.currency)}</Td>
              <Td>{t.enums.paymentProvider[p.provider]}</Td>
              <Td className="max-w-48 break-all text-xs text-muted">
                {p.providerPaymentId ?? "—"}
                {p.failureReason && <span className="block text-danger">{p.failureReason}</span>}
              </Td>
              <Td>
                <PaymentStatusBadge status={p.status} />
              </Td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr>
              <Td className="text-muted">Henüz ödeme yok.</Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
