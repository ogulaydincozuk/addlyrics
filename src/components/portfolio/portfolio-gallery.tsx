"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Play, X } from "lucide-react";
import { LyricScene } from "@/components/lyrics/lyric-scene";
import { ASPECT_CLASS } from "@/components/lyrics/scene-presets";
import { cn } from "@/lib/cn";
import { tiktokPlayerUrl } from "@/lib/embeds";
import type { PublicPortfolioItem } from "@/server/queries/public";

const FILTERS = [
  { id: "tum", label: "Tüm Videolar", test: () => true },
  { id: "film-edit", label: "Film Edit", test: (i: PublicPortfolioItem) => i.category === "FILM_EDIT" },
  { id: "minimal", label: "Minimal Lyrics", test: (i: PublicPortfolioItem) => i.category === "MINIMAL" },
  { id: "music-video", label: "Music Video", test: (i: PublicPortfolioItem) => i.category === "MUSIC_VIDEO" },
  { id: "dikey", label: "Dikey Videolar", test: (i: PublicPortfolioItem) => i.orientation === "VERTICAL" },
  { id: "yatay", label: "Yatay Videolar", test: (i: PublicPortfolioItem) => i.orientation === "HORIZONTAL" },
] as const;

const CATEGORY_LABEL: Record<PublicPortfolioItem["category"], string> = {
  FILM_EDIT: "Film Edit",
  MINIMAL: "Minimal Lyrics",
  MUSIC_VIDEO: "Music Video",
  CUSTOM: "Özel Tasarım",
};

const ORIENTATION_LABEL = { VERTICAL: "9:16", HORIZONTAL: "16:9", SQUARE: "1:1" } as const;

export function PortfolioGallery({ items, syncHash = false, limit }: { items: PublicPortfolioItem[]; syncHash?: boolean; limit?: number }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("tum");
  const [active, setActive] = useState<PublicPortfolioItem | null>(null);

  useEffect(() => {
    if (!syncHash) return;
    const fromHash = () => {
      const h = window.location.hash.replace("#", "");
      if (FILTERS.some((f) => f.id === h)) setFilter(h as typeof filter);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [syncHash]);

  const choose = (id: typeof filter) => {
    setFilter(id);
    if (syncHash) history.replaceState(null, "", id === "tum" ? window.location.pathname : `#${id}`);
  };

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const list = items.filter(f.test);
    return limit ? list.slice(0, limit) : list;
  }, [items, filter, limit]);

  const hasDemo = items.some((i) => i.isDemo);

  return (
    <div>
      <div role="tablist" aria-label="Kategori filtreleri" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            type="button"
            aria-selected={filter === f.id}
            onClick={() => choose(f.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              filter === f.id ? "bg-lime text-ink shadow-sm ring-1 ring-[#c4e534]" : "bg-card text-ink-soft ring-1 ring-line hover:text-brand hover:ring-brand-soft",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {hasDemo && (
        <p className="mx-auto mt-4 flex max-w-2xl items-start justify-center gap-2 text-center text-sm text-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          &quot;Stil önizlemesi&quot; etiketli kartlar video tarzlarını anlatan örneklerdir; müşteri işi değildir.
        </p>
      )}

      {visible.length === 0 ? (
        <p className="mt-12 text-center text-muted">Bu kategoride henüz örnek yok.</p>
      ) : (
        <div className="mt-8 columns-1 gap-6 sm:columns-2 lg:columns-3">
          {visible.map((item) => (
            <article key={item.id} className="mb-6 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
              <button
                type="button"
                onClick={() => setActive(item)}
                className="group relative block w-full text-left"
                aria-label={`${item.title} videosunu oynat`}
              >
                <MediaPreview item={item} />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                  <span className="flex size-14 items-center justify-center rounded-full bg-white/95 text-brand shadow-lg transition-transform group-hover:scale-105">
                    <Play className="size-6 translate-x-0.5" fill="currentColor" aria-hidden />
                  </span>
                </span>
              </button>
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-brand-ink">{CATEGORY_LABEL[item.category]}</span>
                  <span className="rounded-full bg-canvas px-2.5 py-0.5 text-muted ring-1 ring-line">{ORIENTATION_LABEL[item.orientation]}</span>
                </div>
                <h3 className="mt-3 font-display text-base font-bold text-ink">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      <VideoModal item={active} onClose={() => setActive(null)} />
    </div>
  );
}

const EMBED_POSTER_BG: Record<PublicPortfolioItem["category"], string> = {
  FILM_EDIT: "linear-gradient(165deg, #0b1324 0%, #1d3557 55%, #b45309 120%)",
  MINIMAL: "linear-gradient(165deg, #111827 0%, #1f2937 60%, #374151 100%)",
  MUSIC_VIDEO: "linear-gradient(165deg, #1e1035 0%, #4c1d95 60%, #be185d 120%)",
  CUSTOM: "linear-gradient(165deg, #0a0a0a 0%, #262626 100%)",
};

/** Gömülü (TikTok) video kapağı. Oynatıcı yalnızca tıklanınca yüklenir. */
export function EmbedPoster({ item, aspectClass }: { item: PublicPortfolioItem; aspectClass?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-slate-900", aspectClass ?? ASPECT_CLASS[item.orientation])}>
      {item.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- TikTok kapak görseli (oEmbed), optimizasyon gerekmez
        <img src={item.posterUrl} alt="" className="size-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <div className="size-full" style={{ background: EMBED_POSTER_BG[item.category] }}>
          <div className="film-grain pointer-events-none absolute inset-[-50%] opacity-10 mix-blend-overlay" />
          <div className="absolute inset-x-0 top-[17%] px-6 text-center">
            <p className="font-display text-lg font-extrabold leading-tight text-white/95">{CATEGORY_LABEL[item.category]}</p>
            <p className="mt-1 text-xs font-medium text-white/70">Gerçek örnek video</p>
          </div>
        </div>
      )}
      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">TikTok</span>
      {item.embed?.handle && (
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          @{item.embed.handle}
        </span>
      )}
    </div>
  );
}

function MediaPreview({ item }: { item: PublicPortfolioItem }) {
  if (item.embed) return <EmbedPoster item={item} />;
  if (item.isDemo || !item.videoUrl) {
    return <LyricScene preset={item.demoPreset ?? "film-dusk"} orientation={item.orientation} badge={item.isDemo ? "Stil önizlemesi" : null} />;
  }
  return (
    <div className={cn("relative bg-slate-900", ASPECT_CLASS[item.orientation])}>
      {item.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- yetki kontrollü medya rotası, optimizasyon gerekmez
        <img src={item.posterUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <video src={item.videoUrl} muted playsInline preload="metadata" className="size-full object-cover" />
      )}
    </div>
  );
}

export function VideoModal({ item, onClose }: { item: PublicPortfolioItem | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (item && !dialog.open) dialog.showModal();
    if (!item && dialog.open) dialog.close();
  }, [item]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(96vw,980px)] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-slate-900/70 backdrop:backdrop-blur-sm"
      aria-label={item?.title ?? "Video"}
    >
      {item && (
        <div className="rounded-2xl bg-white p-3 shadow-2xl sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-4 px-1">
            <div className="min-w-0">
              <p className="truncate font-display font-bold text-ink">{item.title}</p>
              <p className="text-xs text-muted">
                {CATEGORY_LABEL[item.category]} · {ORIENTATION_LABEL[item.orientation]}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink ring-1 ring-line hover:bg-brand-tint"
              aria-label="Kapat"
            >
              <X className="size-4" />
            </button>
          </div>
          <div
            className={cn(
              "mx-auto overflow-hidden rounded-xl bg-black",
              item.orientation === "HORIZONTAL" ? "w-full" : item.orientation === "SQUARE" ? "w-full max-w-[min(70vh,640px)]" : "w-full max-w-[min(42vh,380px)]",
            )}
          >
            {item.embed ? (
              <div className="aspect-[9/16] w-full">
                <iframe
                  src={tiktokPlayerUrl(item.embed.id, { autoplay: true })}
                  title={`${item.title} — TikTok videosu`}
                  className="size-full border-0"
                  allow="encrypted-media; fullscreen; autoplay; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : item.isDemo || !item.videoUrl ? (
              <LyricScene preset={item.demoPreset ?? "film-dusk"} orientation={item.orientation} playing controls badge="Stil önizlemesi" />
            ) : (
              <video
                src={item.videoUrl}
                poster={item.posterUrl ?? undefined}
                controls
                autoPlay
                playsInline
                className={cn("block w-full", ASPECT_CLASS[item.orientation])}
              />
            )}
          </div>
          {item.isDemo && (
            <p className="mt-3 px-1 text-xs text-muted">
              Bu bir stil önizlemesidir. Gerçek videolar, şarkına ve tercihlerine göre editörlerimiz tarafından hazırlanır.
            </p>
          )}
          {item.embed && (
            <p className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
              <span>Video TikTok oynatıcısıyla gösterilir; oynatıldığında TikTok&apos;un gizlilik koşulları geçerlidir.</span>
              <a href={item.embed.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
                TikTok&apos;ta aç ↗
              </a>
            </p>
          )}
        </div>
      )}
    </dialog>
  );
}
