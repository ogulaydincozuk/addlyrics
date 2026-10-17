import Link from "next/link";
import { ArrowRight, Check, ChevronDown, FolderUp, Music4, PackageCheck, Wand2 } from "lucide-react";
import { LyricScene } from "@/components/lyrics/lyric-scene";
import { LinkButton } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/primitives";
import type { SettingValue } from "@/content/settings";
import type { PublicPortfolioItem } from "@/server/queries/public";
import { StyleCards, type StyleCardData } from "./style-cards";

type Home = SettingValue<"home">;

const STYLE_CARDS = [
  { key: "FILM_EDIT", preset: "film-night", hash: "film-edit" },
  { key: "MINIMAL", preset: "minimal-paper", hash: "minimal" },
  { key: "MUSIC_VIDEO", preset: "clip-studio", hash: "music-video" },
] as const;

export function StylesSection({ home, portfolio }: { home: Home; portfolio: PublicPortfolioItem[] }) {
  // Her tarz için ilk gerçek (demo olmayan) örnek; yoksa yerleşik stil önizlemesi gösterilir
  const cards: StyleCardData[] = STYLE_CARDS.map(({ key, preset, hash }) => ({
    key,
    hash,
    fallbackPreset: preset,
    title: home.styles[key].title,
    description: home.styles[key].description,
    example: portfolio.find((p) => p.category === key && !p.isDemo && (p.embed || p.videoUrl)) ?? null,
  }));
  return (
    <section className="py-20 sm:py-24" aria-labelledby="tarzlar">
      <Container>
        <SectionHeading eyebrow="Video tarzları" title={home.stylesTitle} />
        <StyleCards cards={cards} />
      </Container>
    </section>
  );
}

const STEP_ICONS = [PackageCheck, FolderUp, Wand2, Music4];

export function HowItWorksSection({ home }: { home: Home }) {
  return (
    <section id="nasil-calisir" className="border-y border-line bg-white py-20 sm:py-24" aria-labelledby="nasil-calisir-baslik">
      <Container>
        <SectionHeading eyebrow="4 adımda" title={home.stepsTitle} description="Satın almadan teslimata kadar tüm süreç tek bir panelden ilerler." />
        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {home.steps.map((step, i) => {
            const Icon = STEP_ICONS[i] ?? PackageCheck;
            return (
              <li key={step.title} className="relative rounded-2xl border border-line bg-canvas p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-lime text-ink shadow-[0_8px_20px_-10px_rgb(150_190_20/0.8)] ring-1 ring-inset ring-[#c4e534]">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="font-display text-4xl font-extrabold text-brand-soft">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-6 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{step.description}</p>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}

export function WhySection({ home }: { home: Home }) {
  return (
    <section className="py-20 sm:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHeading align="left" eyebrow="Neden AddLyrics?" title={home.whyTitle} />
          <ul className="mt-8 space-y-4">
            {home.whyPoints.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
                <span className="text-[1.02rem] text-ink-soft">{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4 pt-10">
              <div className="overflow-hidden rounded-2xl border-4 border-white shadow-[var(--shadow-lift)]">
                <LyricScene preset="clip-stage" orientation="VERTICAL" badge={null} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border-4 border-white shadow-[var(--shadow-lift)]">
                <LyricScene preset="minimal-paper" orientation="SQUARE" badge={null} />
              </div>
              <div className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Panelinde</p>
                <p className="mt-1 font-display text-lg font-bold text-ink">Sipariş durumu, teslimler ve kalan video hakların</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-soft">
                  <div className="h-full w-2/3 rounded-full bg-brand" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function FaqList({ items }: { items: Array<{ id: string; question: string; answer: string }> }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
      {items.map((item) => (
        <details key={item.id} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-ink transition-colors hover:bg-canvas sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="px-5 pb-5 text-[0.95rem] leading-relaxed text-muted sm:px-6">
            {item.answer.split("\n").map((para, i) => (
              <p key={i} className={i ? "mt-3" : undefined}>
                {para}
              </p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export function FaqSection({ title, items }: { title: string; items: Array<{ id: string; question: string; answer: string }> }) {
  if (!items.length) return null;
  return (
    <section id="sss" className="border-t border-line bg-white py-20 sm:py-24">
      <Container className="max-w-3xl">
        <SectionHeading title={title} />
        <div className="mt-10">
          <FaqList items={items.slice(0, 8)} />
        </div>
        {items.length > 8 && (
          <div className="mt-8 text-center">
            <LinkButton href="/sss" variant="secondary">
              Tüm soruları gör
            </LinkButton>
          </div>
        )}
      </Container>
    </section>
  );
}

export function FinalCta({ home }: { home: Home }) {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-[1.75rem] bg-logo-black px-6 py-14 text-center text-white sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgb(223_255_76/0.16),transparent_60%),radial-gradient(50%_70%_at_0%_100%,rgb(223_255_76/0.08),transparent_60%)]" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold sm:text-4xl">{home.finalTitle}</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">{home.finalDescription}</p>
            <Link
              href="/paketler"
              className="mt-8 inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-lime px-7 font-semibold text-ink shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-lime-hover"
            >
              {home.finalCta}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
