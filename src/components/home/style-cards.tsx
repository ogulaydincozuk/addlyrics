"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Clapperboard, Play, Type, Video } from "lucide-react";
import { LyricScene } from "@/components/lyrics/lyric-scene";
import { EmbedPoster, VideoModal } from "@/components/portfolio/portfolio-gallery";
import type { PublicPortfolioItem } from "@/server/queries/public";

const ICONS = { FILM_EDIT: Clapperboard, MINIMAL: Type, MUSIC_VIDEO: Video } as const;

export type StyleCardData = {
  key: "FILM_EDIT" | "MINIMAL" | "MUSIC_VIDEO";
  title: string;
  description: string;
  hash: string;
  fallbackPreset: string;
  example: PublicPortfolioItem | null;
};

/** "Şarkına hangi görsel tarz yakışıyor?" kartları: varsa gerçek örnek, yoksa stil önizlemesi. */
export function StyleCards({ cards }: { cards: StyleCardData[] }) {
  const [active, setActive] = useState<PublicPortfolioItem | null>(null);
  return (
    <>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = ICONS[card.key];
          return (
            <article
              key={card.key}
              className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-lift)]"
            >
              <div className="p-3 pb-0">
                <div className="overflow-hidden rounded-xl">
                  {card.example ? (
                    <button
                      type="button"
                      onClick={() => setActive(card.example)}
                      className="relative block w-full"
                      aria-label={`${card.title} örneğini oynat`}
                    >
                      <EmbedPoster item={card.example} aspectClass="aspect-[4/5]" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/15">
                        <span className="flex size-14 items-center justify-center rounded-full bg-white/95 text-brand shadow-lg transition-transform group-hover:scale-105">
                          <Play className="size-6 translate-x-0.5" fill="currentColor" aria-hidden />
                        </span>
                      </span>
                    </button>
                  ) : (
                    <LyricScene preset={card.fallbackPreset} orientation="SQUARE" />
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand-tint text-brand">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <h3 className="text-lg font-bold text-ink">{card.title}</h3>
                </div>
                <p className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-muted">{card.description}</p>
                <Link
                  href={`/ornekler#${card.hash}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:gap-2.5 hover:underline"
                >
                  Örneği İncele <ArrowRight className="size-4 transition-all" aria-hidden />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <VideoModal item={active} onClose={() => setActive(null)} />
    </>
  );
}
