import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { CONTENT_PAGE_SLUGS } from "@/content/settings";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActionForm } from "../../_forms";
import { AdminPage, Section } from "../../_ui";
import { savePageAction } from "../../icerik/actions";

export const metadata: Metadata = { title: "Sayfa Düzenle" };

export default function EditContentPage({ params }: PageProps<"/admin/sayfalar/[slug]">) {
  return (
    <div>
      <Link href="/admin/sayfalar" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden /> Sayfalar
      </Link>
      <AdminPage title="Sayfa düzenle">
        <Content params={params} />
      </AdminPage>
    </div>
  );
}

async function Content({ params }: Pick<PageProps<"/admin/sayfalar/[slug]">, "params">) {
  await requireAdmin();
  const { slug } = await params;
  if (!(CONTENT_PAGE_SLUGS as readonly string[]).includes(slug)) notFound();
  const page = await db.contentPage.findUnique({ where: { slug_locale: { slug, locale: "tr" } } });
  const isLegal = slug !== "hakkimizda";
  return (
    <Section
      title={page?.title ?? slug}
      actions={
        <Link href={`/${slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          Sitede gör <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      }
    >
      <ActionForm action={savePageAction.bind(null, slug)} submitLabel="Sayfayı kaydet">
        <Field label="Başlık" htmlFor="title">
          <Input id="title" name="title" defaultValue={page?.title ?? ""} />
        </Field>
        <Field label="Meta açıklama (SEO)" htmlFor="metaDescription" optional>
          <Input id="metaDescription" name="metaDescription" defaultValue={page?.metaDescription ?? ""} maxLength={300} />
        </Field>
        <Field
          label="İçerik"
          htmlFor="body"
          hint="Biçim: ## Başlık, ### Alt başlık, - madde, > not, **kalın**, [bağlantı](https://…). Paragraflar arasında boş satır bırak."
        >
          <Textarea id="body" name="body" rows={22} defaultValue={page?.body ?? ""} className="font-mono text-sm" />
        </Field>
        {isLegal && (
          <Checkbox
            name="reviewed"
            defaultChecked={Boolean(page?.reviewedAt)}
            label="Bu metin hukuk danışmanı tarafından incelendi"
            description="İşaretlenmezse sitede “taslak” uyarısı gösterilir."
          />
        )}
      </ActionForm>
    </Section>
  );
}
