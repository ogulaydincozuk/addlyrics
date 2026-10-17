import type { Metadata } from "next";
import Link from "next/link";
import { refresh } from "next/cache";
import { Inbox, Mail } from "lucide-react";
import { OrderStatusBadge } from "@/components/order/status-badge";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { MESSAGE_THREAD_LABELS, MESSAGE_THREAD_TONES } from "@/lib/order-messages";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getOrderMessageThreads } from "@/server/queries/messages";
import { ActionForm } from "../_forms";
import { AdminPage, Section } from "../_ui";
import { markMessagesHandledAction } from "../siparisler/actions";

export const metadata: Metadata = { title: "Mesajlar" };

async function toggleHandled(id: string, handled: boolean, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  "use server";
  await requireAdmin();
  await db.contactMessage.update({ where: { id }, data: { handledAt: handled ? new Date() : null } });
  refresh();
  return { ok: true };
}

export default function MessagesPage() {
  return (
    <AdminPage
      title="Mesajlar"
      description="Siparişlerdeki müşteri mesajları ve iletişim formu. Son sözü müşteride olan konuşmalar “Yanıt bekliyor” olarak en üstte görünür."
    >
      <Messages />
    </AdminPage>
  );
}

async function Messages() {
  await requireAdmin();
  const [threads, contacts] = await Promise.all([
    getOrderMessageThreads(),
    db.contactMessage.findMany({ orderBy: [{ handledAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }], take: 200 }),
  ]);
  const awaiting = threads.filter((t) => t.state === "AWAITING_REPLY").length;
  const openContacts = contacts.filter((c) => !c.handledAt).length;

  return (
    <div className="space-y-6">
      <Section
        title="Sipariş mesajları"
        description={awaiting ? `${awaiting} konuşma ekip yanıtı bekliyor.` : "Yanıt bekleyen sipariş mesajı yok."}
      >
        {threads.length ? (
          <ul className="space-y-3">
            {threads.map((t) => (
              <li key={t.orderId} className={cn("rounded-2xl border bg-card p-4 sm:p-5", t.state === "AWAITING_REPLY" ? "border-[#fde68a] bg-warning-soft/30" : "border-line")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      <Link href={`/admin/siparisler/${t.number}#mesajlar`} className="hover:text-brand hover:underline">
                        {t.number}
                      </Link>{" "}
                      · {t.song}
                    </p>
                    <p className="text-sm text-muted">
                      {t.customerName} ·{" "}
                      <a href={`mailto:${t.customerEmail}`} className="text-brand hover:underline">
                        {t.customerEmail}
                      </a>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={t.status} />
                    <Badge tone={MESSAGE_THREAD_TONES[t.state]}>{MESSAGE_THREAD_LABELS[t.state]}</Badge>
                  </div>
                </div>
                {t.last && (
                  <div className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-sm ring-1 ring-line">
                    <p className="text-xs font-semibold text-muted">
                      {t.last.from === "customer" ? "Müşteri" : "Ekip"} · {formatDateTime(t.last.at)} · toplam {t.messageCount} mesaj
                    </p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-ink-soft">{t.last.text}</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <LinkButton href={`/admin/siparisler/${t.number}#mesajlar`} size="sm" variant={t.state === "AWAITING_REPLY" ? "primary" : "secondary"}>
                    {t.state === "AWAITING_REPLY" ? "Yanıtla" : "Konuşmayı aç"}
                  </LinkButton>
                  {t.state === "AWAITING_REPLY" && (
                    <ActionForm action={markMessagesHandledAction.bind(null, t.orderId)} submitLabel="Yanıt gerekmiyor" variant="ghost" inline />
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Inbox className="size-6" />} title="Henüz sipariş mesajı yok" description="Müşteriler sipariş sayfalarından yazdığında burada görünür." />
        )}
      </Section>

      <Section
        title="İletişim formu"
        description={openContacts ? `${openContacts} mesaj bekliyor. Yanıtlar e-posta ile verilir.` : "Siteden gelen mesajlar. Yanıtlar e-posta ile verilir."}
      >
        {contacts.length ? (
          <div className="space-y-3">
            {contacts.map((m) => (
              <article key={m.id} className="rounded-2xl border border-line bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{m.subject || "(Konu yok)"}</p>
                    <p className="text-sm text-muted">
                      {m.name} ·{" "}
                      <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject ?? "AddLyrics"}`)}`} className="text-brand hover:underline">
                        {m.email}
                      </a>{" "}
                      · {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                  <Badge tone={m.handledAt ? "success" : "warning"}>{m.handledAt ? "Yanıtlandı" : "Bekliyor"}</Badge>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">{m.message}</p>
                <ActionForm
                  action={toggleHandled.bind(null, m.id, !m.handledAt)}
                  submitLabel={m.handledAt ? "Bekliyor olarak işaretle" : "Yanıtlandı olarak işaretle"}
                  variant="secondary"
                  className="mt-3"
                />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Mail className="size-6" />} title="İletişim formundan mesaj yok" />
        )}
      </Section>
    </div>
  );
}
