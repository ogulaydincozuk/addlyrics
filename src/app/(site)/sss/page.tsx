import type { Metadata } from "next";
import Link from "next/link";
import { FaqList } from "@/components/home/sections";
import { PageHeader } from "@/components/site/page-header";
import { Container } from "@/components/ui/primitives";
import { getPublicFaq } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Sıkça Sorulan Sorular",
  description: "AddLyrics lyrics video paketleri, sipariş süreci, teslimat ve ödeme hakkında sıkça sorulan sorular.",
  alternates: { canonical: "/sss" },
};

export default async function FaqPage() {
  const items = await getPublicFaq();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })),
  };
  return (
    <>
      <PageHeader eyebrow="SSS" title="Sıkça Sorulan Sorular" description="Aradığın cevabı bulamazsan bize yazabilirsin." />
      <Container className="max-w-3xl py-12 sm:py-16">
        {items.length ? <FaqList items={items} /> : <p className="text-muted">Henüz soru eklenmedi.</p>}
        <p className="mt-10 text-center text-sm text-muted">
          Başka bir sorun mu var?{" "}
          <Link href="/iletisim" className="font-semibold text-brand hover:underline">
            İletişim sayfasından
          </Link>{" "}
          bize ulaş.
        </p>
      </Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
