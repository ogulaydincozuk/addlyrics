import type { Metadata } from "next";
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";
import { PageHeader } from "@/components/site/page-header";
import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { getPublicPortfolio, getSetting } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Lyrics Video Örnekleri",
  description:
    "Film edit, minimal ve klip üzerine lyrics video tarzlarını incele. Rap lyrics video, şarkı sözleri videosu ve dikey/yatay formatlarda örnekler.",
  alternates: { canonical: "/ornekler" },
};

export default async function ExamplesPage() {
  const [items, home] = await Promise.all([getPublicPortfolio(), getSetting("home")]);
  return (
    <>
      <PageHeader eyebrow="Video örnekleri" title={home.portfolioTitle} description={home.portfolioDescription} />
      <Container className="py-12 sm:py-16">
        <PortfolioGallery items={items} syncHash />
        <div className="mt-14 rounded-2xl border border-line bg-card p-8 text-center">
          <p className="font-display text-xl font-bold text-ink">Şarkın için hangi tarz uygun?</p>
          <p className="mx-auto mt-2 max-w-lg text-muted">Paketini seç, sipariş formunda görsel tarzını ve formatlarını belirt.</p>
          <LinkButton href="/paketler" className="mt-6">
            Paketleri İncele
          </LinkButton>
        </div>
      </Container>
    </>
  );
}
