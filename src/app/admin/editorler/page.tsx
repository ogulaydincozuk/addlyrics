import type { Metadata } from "next";
import Link from "next/link";
import type { Editor } from "@prisma/client";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { VIDEO_STYLES } from "@/lib/enums";
import { ACTIVE_STATUSES } from "@/lib/order-status";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../_forms";
import { AdminPage, Section } from "../_ui";
import { saveEditorAction } from "./actions";

export const metadata: Metadata = { title: "Editörler" };

export default function EditorsPage() {
  return (
    <AdminPage title="Editörler" description="Siparişlerin atanacağı video editörleri.">
      <Editors />
    </AdminPage>
  );
}

function EditorFields({ editor }: { editor: Editor | null }) {
  const t = messages();
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Ad Soyad" htmlFor={`name-${editor?.id ?? "new"}`}>
          <Input id={`name-${editor?.id ?? "new"}`} name="name" defaultValue={editor?.name ?? ""} required />
        </Field>
        <Field label="E-posta" htmlFor={`email-${editor?.id ?? "new"}`} optional>
          <Input id={`email-${editor?.id ?? "new"}`} name="email" type="email" defaultValue={editor?.email ?? ""} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Uzmanlık</legend>
        <div className="flex flex-wrap gap-4">
          {VIDEO_STYLES.map((s) => (
            <Checkbox key={s} name="specialties" value={s} defaultChecked={editor?.specialties.includes(s) ?? false} label={t.enums.videoStyleShort[s]} />
          ))}
        </div>
      </fieldset>
      <Field label="Notlar" htmlFor={`notes-${editor?.id ?? "new"}`} optional>
        <Textarea id={`notes-${editor?.id ?? "new"}`} name="notes" rows={2} defaultValue={editor?.notes ?? ""} />
      </Field>
      <Checkbox name="active" defaultChecked={editor?.active ?? true} label="Aktif (yeni sipariş atanabilir)" />
    </>
  );
}

async function Editors() {
  await requireAdmin();
  const t = messages();
  const editors = await db.editor.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      assignments: {
        where: { active: true },
        include: { order: { select: { number: true, status: true, song: { select: { title: true } } } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <Alert tone="info">
        İlk sürümde editörler sisteme giriş yapmaz; atamaları yönetim ekibi yapar. Veri modeli, ileride her editörün yalnızca kendisine atanan
        siparişleri göreceği bir editör paneline hazırdır (Editor.userId).
      </Alert>
      <Section title="Yeni editör">
        <ActionForm action={saveEditorAction.bind(null, null)} submitLabel="Editör ekle">
          <EditorFields editor={null} />
        </ActionForm>
      </Section>
      {editors.map((e) => {
        const working = e.assignments.filter((a) => ACTIVE_STATUSES.includes(a.order.status));
        return (
          <Section
            key={e.id}
            title={e.name}
            description={e.specialties.length ? e.specialties.map((s) => t.enums.videoStyleShort[s]).join(" · ") : "Uzmanlık belirtilmedi"}
            actions={<Badge tone={e.active ? "success" : "neutral"}>{e.active ? "Aktif" : "Pasif"}</Badge>}
          >
            {working.length > 0 && (
              <p className="mb-4 text-sm text-muted">
                Üzerindeki işler:{" "}
                {working.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ", "}
                    <Link href={`/admin/siparisler/${a.order.number}`} className="font-medium text-brand hover:underline">
                      {a.order.number}
                    </Link>{" "}
                    ({a.order.song.title})
                  </span>
                ))}
              </p>
            )}
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-brand">Düzenle</summary>
              <div className="mt-4">
                <ActionForm action={saveEditorAction.bind(null, e.id)} submitLabel="Kaydet">
                  <EditorFields editor={e} />
                </ActionForm>
              </div>
            </details>
          </Section>
        );
      })}
    </div>
  );
}
