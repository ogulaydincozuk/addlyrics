import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnouncementSlot } from "@/components/site/promo-slots";
import { Hero } from "@/components/home/hero";
import { FaqSection, FinalCta, HowItWorksSection, StylesSection, WhySection } from "@/components/home/sections";
import { PackageCards } from "@/components/packages/package-cards";
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";
import { LinkButton } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/primitives";
import { getPublicFaq, getPublicPackages, getPublicPortfolio, getSetting } from "@/server/queries/public";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSetting("seo");
  return {
    title: { absolute: seo.siteTitle },
    description: seo.siteDescription,
    alternates: { canonical: "/" },
    openGraph: { title: seo.siteTitle, description: seo.siteDescription, url: "/" },
  };
}

export default async function HomePage() {
  const [home, packages, portfolio, faq] = await Promise.all([
    getSetting("home"),
    getPublicPackages(),
    getPublicPortfolio(),
    getPublicFaq(),
  ]);

  return (
    <>
      {/* Yayında duyuru yoksa hiçbir şey çizilmez */}
      <Suspense fallback={null}>
        <AnnouncementSlot />
      </Suspense>
      <Hero home={home} />
      <StylesSection home={home} portfolio={portfolio} />
      <HowItWorksSection home={home} />

      <section id="paketler" className="py-20 sm:py-24" aria-labelledby="paketler-baslik">
        <Container>
          <SectionHeading eyebrow="Aylık lyrics video paketleri" title={home.packagesTitle} description={home.packagesDescription} />
          <div className="mt-12">
            <PackageCards packages={packages} />
          </div>
          {packages.length > 1 && (
            <p className="mt-8 text-center text-sm text-muted">
              Paketleri yan yana karşılaştırmak için{" "}
              <a href="/paketler#karsilastirma" className="font-semibold text-brand hover:underline">
                karşılaştırma tablosuna
              </a>{" "}
              göz at.
            </p>
          )}
        </Container>
      </section>

      <section id="ornekler" className="border-y border-line bg-white py-20 sm:py-24">
        <Container>
          <SectionHeading eyebrow="Video örnekleri" title={home.portfolioTitle} description={home.portfolioDescription} />
          <div className="mt-10">
            <PortfolioGallery items={portfolio} limit={6} />
          </div>
          {portfolio.length > 6 && (
            <div className="mt-4 text-center">
              <LinkButton href="/ornekler" variant="secondary">
                Tüm örnekleri gör
              </LinkButton>
            </div>
          )}
        </Container>
      </section>

      <WhySection home={home} />
      <FaqSection title={home.faqTitle} items={faq} />
      <FinalCta home={home} />
      <JsonLd />
    </>
  );
}

async function JsonLd() {
  const seo = await getSetting("seo");
  const data = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "AddLyrics lyrics video hazırlama",
    serviceType: "Lyrics video hazırlama",
    description: seo.siteDescription,
    provider: { "@type": "Organization", name: "AddLyrics" },
    areaServed: "TR",
    availableLanguage: "tr",
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
