import type { Metadata } from "next";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/primitives";
import { ANNOUNCEMENT_DISPLAY_LABEL, ANNOUNCEMENT_STATUS_LABEL, isAnnouncementLive, pickActiveAnnouncement } from "@/lib/announcements";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../_forms";
import { AdminPage, Section } from "../_ui";
import { deleteAnnouncementAction, publishAnnouncementAction, saveAnnouncementAction } from "./actions";

export const metadata: Metadata = { title: "Duyurular" };

export default function AnnouncementsPage() {
  return (
    <AdminPage title="Güncelleme Duyuruları" description="Yayında ve tarih aralığında olan duyuru ana sayfada gösterilir. Aktif duyuru yoksa sitede hiçbir duyuru alanı görünmez.">
      <Announcements />
    </AdminPage>
  );
}

type Defaults = {
  title: string;
  body: string;
  linkLabel: string | null;
  linkUrl: string | null;
  display: "MODAL" | "BANNER" | "TOAST";
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
};

function AnnouncementFields({ d, idPrefix }: { d?: Defaults; idPrefix: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Başlık" htmlFor={`${idPrefix}-title`} className="sm:col-span-2">
        <Input id={`${idPrefix}-title`} name="title" defaultValue={d?.title} required maxLength={160} />
      </Field>
      <Field label="Açıklama" htmlFor={`${idPrefix}-body`} className="sm:col-span-2">
        <Textarea id={`${idPrefix}-body`} name="body" rows={3} defaultValue={d?.body} required maxLength={2000} />
      </Field>
      <Field label="Buton metni" htmlFor={`${idPrefix}-linkLabel`} optional>
        <Input id={`${idPrefix}-linkLabel`} name="linkLabel" defaultValue={d?.linkLabel ?? ""} maxLength={40} />
      </Field>
      <Field label="Bağlantı" htmlFor={`${idPrefix}-linkUrl`} optional hint="/paketler veya https://…">
        <Input id={`${idPrefix}-linkUrl`} name="linkUrl" defaultValue={d?.linkUrl ?? ""} />
      </Field>
      <Field label="Gösterim" htmlFor={`${idPrefix}-display`}>
        <Select id={`${idPrefix}-display`} name="display" defaultValue={d?.display ?? "BANNER"}>
          {(["BANNER", "MODAL", "TOAST"] as const).map((v) => (
            <option key={v} value={v}>
              {ANNOUNCEMENT_DISPLAY_LABEL[v]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Öncelik" htmlFor={`${idPrefix}-priority`} hint="Birden fazla aktif duyuruda büyük olan gösterilir.">
        <Input id={`${idPrefix}-priority`} name="priority" type="number" min={-100} max={100} defaultValue={d?.priority ?? 0} />
      </Field>
      <Field label="Yayın başlangıcı" htmlFor={`${idPrefix}-startsAt`} optional>
        <Input id={`${idPrefix}-startsAt`} name="startsAt" type="date" defaultValue={toDateInputValue(d?.startsAt ?? null)} />
      </Field>
      <Field label="Yayın bitişi" htmlFor={`${idPrefix}-endsAt`} optional>
        <Input id={`${idPrefix}-endsAt`} name="endsAt" type="date" defaultValue={toDateInputValue(d?.endsAt ?? null)} />
      </Field>
    </div>
  );
}

async function Announcements() {
  await requireAdmin();
  const items = await db.announcement.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }], include: { createdBy: { select: { name: true } } } });
  const active = pickActiveAnnouncement(items);

  return (
    <div className="space-y-6">
      {active ? (
        <Alert tone="success" title="Şu an ana sayfada gösterilen">
          {active.title} ({ANNOUNCEMENT_DISPLAY_LABEL[active.display]})
        </Alert>
      ) : (
        <Alert tone="info">Şu an aktif duyuru yok; ana sayfada duyuru alanı görünmüyor.</Alert>
      )}

      {items.map((a) => (
        <Section
          key={a.id}
          title={a.title}
          description={`${ANNOUNCEMENT_DISPLAY_LABEL[a.display]} · ${a.startsAt ? formatDate(a.startsAt) : "hemen"} – ${a.endsAt ? formatDate(a.endsAt) : "süresiz"} · öncelik ${a.priority} · ${a.createdBy.name}`}
          actions={
            <span className="flex gap-1">
              <Badge tone={a.status === "PUBLISHED" ? "success" : "neutral"}>{ANNOUNCEMENT_STATUS_LABEL[a.status]}</Badge>
              {a.status === "PUBLISHED" && !isAnnouncementLive(a) && <Badge tone="warning">Tarih dışında</Badge>}
            </span>
          }
        >
          <p className="whitespace-pre-line text-sm text-ink-soft">{a.body}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {a.status === "PUBLISHED" ? (
              <ActionForm action={publishAnnouncementAction.bind(null, a.id, false)} submitLabel="Yayından kaldır" variant="secondary" />
            ) : (
              <ActionForm action={publishAnnouncementAction.bind(null, a.id, true)} submitLabel="Yayınla" />
            )}
            {!a.publishedAt && <ActionForm action={deleteAnnouncementAction.bind(null, a.id)} submitLabel="Taslağı sil" variant="danger" confirm="Taslak silinecek." />}
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-brand">Düzenle</summary>
            <div className="mt-4">
              <ActionForm action={saveAnnouncementAction.bind(null, a.id)} submitLabel="Kaydet">
                <AnnouncementFields d={a} idPrefix={a.id} />
              </ActionForm>
            </div>
          </details>
        </Section>
      ))}

      <Section title="Yeni duyuru" description="Önce taslak olarak kaydedilir; yayınlayana kadar sitede görünmez.">
        <ActionForm action={saveAnnouncementAction.bind(null, null)} submitLabel="Taslak olarak kaydet">
          <AnnouncementFields idPrefix="new" />
        </ActionForm>
      </Section>
    </div>
  );
}
