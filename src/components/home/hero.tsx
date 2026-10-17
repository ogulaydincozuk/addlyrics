import { ArrowRight, BadgeCheck, CalendarCheck, Palette, PlayCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { LyricScene } from "@/components/lyrics/lyric-scene";
import type { SettingValue } from "@/content/settings";

export function Hero({ home }: { home: SettingValue<"home"> }) {
  return (
    <section className="relative overflow-hidden">
      {/* yumuşak arka plan ışığı */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_80%_0%,#f1fcb8_0%,transparent_70%),radial-gradient(40%_40%_at_0%_100%,#f9ffe0_0%,transparent_70%)]" />
      <Container className="grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24 lg:pt-20">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-soft bg-white px-3 py-1 text-xs font-semibold text-brand-ink shadow-sm">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            Your Music. Your Lyrics. Your Visuals.
          </p>
          <h1 className="mt-5 text-[2.35rem] font-extrabold leading-[1.08] text-ink sm:text-5xl lg:text-[3.4rem]">{home.heroTitle}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{home.heroDescription}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/paketler" size="lg" icon={null}>
              {home.heroPrimaryCta}
              <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
            <LinkButton href="/ornekler" variant="secondary" size="lg" icon={<PlayCircle className="size-5 text-brand" aria-hidden />}>
              {home.heroSecondaryCta}
            </LinkButton>
          </div>
          <p className="mt-6 text-sm text-muted">Tek seferlik ödeme · Otomatik yenileme yok · Videolar insan editörler tarafından hazırlanır</p>
        </div>

        <HeroVisual />
      </Container>

      <TrustStrip points={home.trustPoints} />
    </section>
  );
}

function HeroVisual() {
  // Yerleşim: üstte yatay film edit; altta (altyazı alanını kapatmadan) dikey ve kare örnekler
  return (
    <div className="relative mx-auto w-full max-w-xl pb-[46%] lg:max-w-none">
      <figure className="relative">
        <div className="overflow-hidden rounded-[1.4rem] border-4 border-white shadow-[var(--shadow-lift)]">
          <LyricScene preset="film-dusk" orientation="HORIZONTAL" />
        </div>
        <figcaption className="mt-2 pr-1 text-right text-xs font-medium text-muted">Film Edit · 16:9</figcaption>
      </figure>

      {/* Dikey telefon önizlemesi */}
      <figure className="absolute bottom-0 left-[2%] w-[27%] animate-float">
        <div className="overflow-hidden rounded-[1.4rem] border-[5px] border-white bg-white shadow-[var(--shadow-lift)]">
          <LyricScene preset="minimal-mono" orientation="VERTICAL" badge={null} />
        </div>
        <figcaption className="mt-2 text-center text-xs font-medium text-muted">Minimal · 9:16</figcaption>
      </figure>

      <div className="absolute bottom-[16%] left-[33%] right-[39%] hidden rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)] sm:block">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tek pakette</p>
        <p className="mt-1 font-display text-sm font-bold leading-snug text-ink">3 görsel tarz, dikey · yatay · kare format</p>
      </div>

      {/* Kare klip önizlemesi */}
      <figure className="absolute bottom-[6%] right-[3%] w-[32%] animate-float [animation-delay:-3.5s]">
        <div className="overflow-hidden rounded-2xl border-[5px] border-white bg-white shadow-[var(--shadow-lift)]">
          <LyricScene preset="clip-stage" orientation="SQUARE" badge={null} />
        </div>
        <figcaption className="mt-2 text-center text-xs font-medium text-muted">Music Video · 1:1</figcaption>
      </figure>
    </div>
  );
}

const TRUST_ICONS = [BadgeCheck, Palette, CalendarCheck];

function TrustStrip({ points }: { points: string[] }) {
  return (
    <div className="border-y border-line bg-white">
      <Container>
        <ul className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {points.map((p, i) => {
            const Icon = TRUST_ICONS[i] ?? BadgeCheck;
            return (
              <li key={p} className="flex items-center gap-3 py-5 sm:justify-center sm:px-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-ink">{p}</span>
              </li>
            );
          })}
        </ul>
      </Container>
    </div>
  );
}
