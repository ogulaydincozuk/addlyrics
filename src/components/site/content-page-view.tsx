import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/site/page-header";
import { Container } from "@/components/ui/primitives";
import type { ContentPageSlug } from "@/content/settings";
import { Markdown } from "@/lib/markdown";
import { getContentPage } from "@/server/queries/public";

/** Hakkımızda ve yasal metinler — içerik admin panelinden (ContentPage) yönetilir. */
export async function contentPageMetadata(slug: ContentPageSlug): Promise<Metadata> {
  const page = await getContentPage(slug);
  if (!page) return {};
  return { title: page.title, description: page.metaDescription ?? undefined, alternates: { canonical: `/${slug}` } };
}

export async function ContentPageView({ slug }: { slug: ContentPageSlug }) {
  const page = await getContentPage(slug);
  if (!page) notFound();

  return (
    <>
      <PageHeader title={page.title} />
      <Container className="max-w-3xl py-12 sm:py-16">
        {page.isLegal && !page.reviewedAt && (
          <p className="mb-8 rounded-xl border border-[#fde68a] bg-warning-soft px-4 py-3 text-sm text-[#78350f]">
            Bu metin taslak niteliğindedir ve hukuki inceleme sürecindedir.
          </p>
        )}
        <Markdown source={page.body} />
        <p className="mt-12 border-t border-line pt-6 text-xs text-muted">
          Son güncelleme:{" "}
          {page.updatedAt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" })}
        </p>
      </Container>
    </>
  );
}
