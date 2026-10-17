import type { Metadata } from "next";
import type { FaqItem } from "@prisma/client";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../_forms";
import { AdminPage, Section } from "../_ui";
import { deleteFaqAction, saveFaqAction } from "../icerik/actions";

export const metadata: Metadata = { title: "SSS" };

export default function FaqAdminPage() {
  return (
    <AdminPage
      title="Sıkça Sorulan Sorular"
      description="“Doğrulanmalı” işaretli cevaplar, gerçek hizmet politikası netleşene kadar gözden geçirilmelidir."
    >
      <Faqs />
    </AdminPage>
  );
}

function FaqFields({ item }: { item: FaqItem | null }) {
  const id = item?.id ?? "new";
  return (
    <>
      <Field label="Soru" htmlFor={`q-${id}`}>
        <Input id={`q-${id}`} name="question" defaultValue={item?.question ?? ""} />
      </Field>
      <Field label="Cevap" htmlFor={`a-${id}`}>
        <Textarea id={`a-${id}`} name="answer" rows={4} defaultValue={item?.answer ?? ""} />
      </Field>
      <div className="flex flex-wrap items-center gap-6">
        <Field label="Sıra" htmlFor={`o-${id}`} className="w-28">
          <Input id={`o-${id}`} name="sortOrder" type="number" min={0} defaultValue={item?.sortOrder ?? 99} />
        </Field>
        <Checkbox name="published" defaultChecked={item?.published ?? true} label="Yayında" />
        <Checkbox name="needsReview" defaultChecked={item?.needsReview ?? false} label="Politika doğrulanmalı" />
      </div>
    </>
  );
}

async function Faqs() {
  await requireAdmin();
  const items = await db.faqItem.findMany({ where: { locale: "tr" }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="space-y-4">
      <Section title="Yeni soru">
        <ActionForm action={saveFaqAction.bind(null, null)} submitLabel="Soruyu ekle">
          <FaqFields item={null} />
        </ActionForm>
      </Section>
      {items.map((item) => (
        <Section
          key={item.id}
          title={`${item.sortOrder}. ${item.question}`}
          actions={
            <div className="flex gap-2">
              {item.needsReview && <Badge tone="warning">Doğrulanmalı</Badge>}
              <Badge tone={item.published ? "success" : "neutral"}>{item.published ? "Yayında" : "Gizli"}</Badge>
            </div>
          }
        >
          <details>
            <summary className="cursor-pointer text-sm text-muted">{item.answer.slice(0, 140)}…</summary>
            <div className="mt-4 space-y-3">
              <ActionForm action={saveFaqAction.bind(null, item.id)} submitLabel="Kaydet">
                <FaqFields item={item} />
              </ActionForm>
              <ActionForm action={deleteFaqAction.bind(null, item.id)} submitLabel="Soruyu sil" variant="ghost" confirm="Bu soru silinsin mi?" />
            </div>
          </details>
        </Section>
      ))}
    </div>
  );
}
