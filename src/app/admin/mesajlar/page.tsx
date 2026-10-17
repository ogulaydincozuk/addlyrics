import type { Metadata } from "next";
import { refresh } from "next/cache";
import { Badge, EmptyState } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../_forms";
import { AdminPage } from "../_ui";

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
    <AdminPage title="Mesajlar" description="İletişim formundan gelen mesajlar. Yanıtlar e-posta ile verilir.">
      <Messages />
    </AdminPage>
  );
}

async function Messages() {
  await requireAdmin();
  const list = await db.contactMessage.findMany({ orderBy: [{ handledAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }], take: 200 });
  if (!list.length) return <EmptyState title="Mesaj yok" />;
  return (
    <div className="space-y-3">
      {list.map((m) => (
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
  );
}
