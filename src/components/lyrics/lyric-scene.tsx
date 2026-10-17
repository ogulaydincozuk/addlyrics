"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { ASPECT_CLASS, getPreset, type ScenePreset } from "./scene-presets";

type Orientation = keyof typeof ASPECT_CLASS;

type Props = {
  preset: string;
  orientation: Orientation;
  /** Kontrollü oynatma; verilmezse görünür olduğunda otomatik oynar */
  playing?: boolean;
  controls?: boolean;
  badge?: string | null;
  className?: string;
  priority?: boolean;
};

/**
 * Animasyonlu lyrics video stil önizlemesi (HTML/SVG). Gerçek bir video dosyası değildir;
 * stillerin nasıl göründüğünü anlatmak için kullanılır ve her zaman "önizleme" olarak etiketlenir.
 */
export function LyricScene({ preset: presetId, orientation, playing, controls = false, badge = "Stil önizlemesi", className }: Props) {
  const preset = getPreset(presetId);
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [frame, setFrame] = useState({ line: 0, step: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const isPlaying = (playing ?? visible) && !userPaused && !reducedMotion;

  // Zaman çizelgesi: yalnızca satır/kelime değiştiğinde yeniden çizilir
  const elapsedRef = useRef(0);
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const total = preset.lines.length * preset.lineDuration;
    const tick = (now: number) => {
      // rAF zaman damgası, efektin başladığı andan biraz önce olabilir → negatif farkı yok say
      const delta = Math.max(0, now - last);
      elapsedRef.current = (((elapsedRef.current + delta) % total) + total) % total;
      last = now;
      const line = Math.min(preset.lines.length - 1, Math.floor(elapsedRef.current / preset.lineDuration));
      const within = (elapsedRef.current % preset.lineDuration) / preset.lineDuration;
      // step: o an vurgulanan kelimenin sırası (satır süresinin ~%85'inde tüm kelimeler görünür)
      const words = preset.lines[line]!.split(" ").length;
      const step = Math.min(words - 1, Math.floor((within / 0.85) * words));
      setFrame((f) => (f.line === line && f.step === step ? f : { line, step }));
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${elapsedRef.current / total})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, preset]);

  const line = preset.lines[frame.line] ?? preset.lines[0]!;
  const step = reducedMotion ? line.split(" ").length - 1 : frame.step;

  return (
    <div
      ref={rootRef}
      className={cn("@container relative isolate overflow-hidden bg-black", ASPECT_CLASS[orientation], className)}
      style={{ background: preset.palette.a }}
      aria-label={`${preset.label} stil önizlemesi`}
      role="img"
    >
      {preset.kind === "film" && <FilmBackdrop preset={preset} animate={isPlaying} />}
      {preset.kind === "minimal" && <MinimalBackdrop preset={preset} />}
      {preset.kind === "clip" && <ClipBackdrop preset={preset} animate={isPlaying} />}

      <Lyrics preset={preset} orientation={orientation} line={line} lineKey={frame.line} step={step} />

      {preset.kind === "film" && orientation === "HORIZONTAL" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[8%] bg-black" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[8%] bg-black" />
        </>
      )}

      {badge && (
        <span className="pointer-events-none absolute left-[4cqw] top-[4cqw] rounded-full bg-white/85 px-[2.4cqw] py-[0.8cqw] text-[max(9px,2.6cqw)] font-semibold text-ink shadow-sm backdrop-blur">
          {badge}
        </span>
      )}

      {controls && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8">
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            className="flex size-9 items-center justify-center rounded-full bg-white text-ink shadow"
            aria-label={isPlaying ? "Duraklat" : "Oynat"}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
          </button>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div ref={progressRef} className="h-full origin-left scale-x-0 rounded-full bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Sözler ─────────────────────────────

function fontSizeFor(kind: ScenePreset["kind"], orientation: Orientation) {
  const table = {
    film: { HORIZONTAL: 3.9, VERTICAL: 7.4, SQUARE: 5.6 },
    minimal: { HORIZONTAL: 6.8, VERTICAL: 12.5, SQUARE: 9.5 },
    clip: { HORIZONTAL: 4.6, VERTICAL: 8.8, SQUARE: 6.6 },
  } as const;
  return `${table[kind][orientation]}cqw`;
}

function Lyrics({
  preset,
  orientation,
  line,
  lineKey,
  step,
}: {
  preset: ScenePreset;
  orientation: Orientation;
  line: string;
  lineKey: number;
  step: number;
}) {
  const words = line.split(" ");
  const fontSize = fontSizeFor(preset.kind, orientation);

  if (preset.kind === "film") {
    return (
      <div className="absolute inset-x-[8%] bottom-[15%] z-10 text-center">
        <p
          key={lineKey}
          className="animate-[lyric-in_0.9s_cubic-bezier(0.22,1,0.36,1)_both] font-serif italic leading-snug [text-shadow:0_2px_12px_rgb(0_0_0/0.55)]"
          style={{ fontSize, color: preset.palette.text }}
        >
          {line}
        </p>
      </div>
    );
  }

  if (preset.kind === "minimal") {
    if (preset.variant === "mono") {
      return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-[1cqw] px-[8%] text-center">
          {words.map((w, i) => (
            <span
              key={`${lineKey}-${i}`}
              className={cn(
                "font-display font-extrabold uppercase leading-[0.95] tracking-tight transition-all duration-300",
                i <= step ? "translate-y-0 scale-100 opacity-100" : "translate-y-[2cqw] scale-95 opacity-0",
              )}
              style={{ fontSize, color: i === step ? preset.palette.accent : preset.palette.text }}
            >
              {w}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="absolute inset-0 z-10 flex items-center px-[10%]">
        <p key={lineKey} className="font-display font-bold leading-tight" style={{ fontSize, color: preset.palette.text }}>
          {words.map((w, i) => (
            <span
              key={i}
              className={cn("inline-block transition-[opacity,transform] duration-500", i <= step ? "opacity-100" : "translate-y-[1cqw] opacity-0")}
            >
              {w}&nbsp;
            </span>
          ))}
          <span
            className="mt-[2cqw] block h-[0.9cqw] origin-left rounded-full transition-transform duration-700"
            style={{ background: preset.palette.accent, transform: `scaleX(${Math.min(1, (step + 1) / words.length)})` }}
          />
        </p>
      </div>
    );
  }

  // clip: karaoke tarzı kelime vurgusu
  const alignLeft = preset.variant === "studio";
  return (
    <div
      className={cn(
        "absolute z-10",
        alignLeft ? "inset-x-[7%] bottom-[12%] border-l-[1cqw] pl-[3cqw]" : "inset-x-[6%] top-[16%] text-center",
      )}
      style={alignLeft ? { borderColor: preset.palette.accent } : undefined}
    >
      <p key={lineKey} className="animate-[lyric-in_0.5s_ease_both] font-display font-extrabold uppercase leading-[1.15] tracking-tight" style={{ fontSize }}>
        {words.map((w, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <span key={i} className="inline-block px-[0.6cqw] py-[0.2cqw]">
              <span
                className="rounded-[0.8cqw] px-[0.8cqw] transition-colors duration-200"
                style={{
                  background: active ? preset.palette.accent : "transparent",
                  color: active ? "#111827" : done ? preset.palette.text : `${preset.palette.text}80`,
                }}
              >
                {w}
              </span>
            </span>
          );
        })}
      </p>
    </div>
  );
}

// ───────────────────────────── Sahneler ─────────────────────────────

function Grain() {
  return <div className="film-grain pointer-events-none absolute inset-[-50%] z-20 opacity-[0.13] mix-blend-overlay" />;
}

function Vignette() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(0_0_0/0.55)_100%)]" />
  );
}

function FilmBackdrop({ preset, animate }: { preset: ScenePreset; animate: boolean }) {
  const p = preset.palette;
  const motion = animate ? "animate-[ken-burns_18s_ease-in-out_infinite_alternate]" : "";
  if (preset.variant === "night") {
    return (
      <>
        <div className={cn("absolute inset-[-6%]", motion)}>
          <svg viewBox="0 0 160 160" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden>
            <defs>
              <linearGradient id="night-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={p.a} />
                <stop offset="0.55" stopColor={p.b} />
                <stop offset="1" stopColor={p.c} />
              </linearGradient>
            </defs>
            <rect width="160" height="160" fill="url(#night-sky)" />
            <circle cx="122" cy="34" r="9" fill="#fdf4dc" opacity="0.9" />
            <circle cx="122" cy="34" r="22" fill="#fdf4dc" opacity="0.08" />
            {BUILDINGS.map((b, i) => (
              <g key={i}>
                <rect x={b.x} y={160 - b.h} width={b.w} height={b.h} fill="#050817" />
                {Array.from({ length: Math.floor(b.h / 9) }).map((_, r) =>
                  Array.from({ length: Math.max(1, Math.floor(b.w / 5)) }).map((__, c) =>
                    (r * 7 + c * 3 + i) % 4 === 0 ? (
                      <rect key={`${r}-${c}`} x={b.x + 1.5 + c * 5} y={160 - b.h + 4 + r * 9} width="2" height="3" fill={p.accent} opacity="0.75" />
                    ) : null,
                  ),
                )}
              </g>
            ))}
          </svg>
        </div>
        {[
          { l: "12%", t: "62%", s: "16cqw", c: p.d },
          { l: "70%", t: "56%", s: "11cqw", c: p.accent },
          { l: "40%", t: "70%", s: "20cqw", c: "#7dd3fc" },
          { l: "82%", t: "76%", s: "14cqw", c: p.d },
        ].map((b, i) => (
          <span
            key={i}
            className={cn("pointer-events-none absolute rounded-full opacity-35 blur-[3cqw]", animate && "animate-[drift_9s_ease-in-out_infinite]")}
            style={{ left: b.l, top: b.t, width: b.s, height: b.s, background: b.c, animationDelay: `${i * -2}s` }}
          />
        ))}
        <Vignette />
        <Grain />
      </>
    );
  }
  return (
    <>
      <div className={cn("absolute inset-[-6%]", motion)}>
        <svg viewBox="0 0 160 160" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden>
          <defs>
            <linearGradient id="dusk-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={p.a} />
              <stop offset="0.45" stopColor={p.b} />
              <stop offset="0.78" stopColor={p.c} />
              <stop offset="1" stopColor={p.d} />
            </linearGradient>
            <radialGradient id="dusk-sun" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff1d6" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fff1d6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="160" height="160" fill="url(#dusk-sky)" />
          <circle cx="104" cy="110" r="34" fill="url(#dusk-sun)" />
          <circle cx="104" cy="110" r="9" fill="#ffe6bd" />
          <path d="M0 112 L18 100 L32 108 L52 92 L70 104 L88 96 L106 108 L126 98 L144 106 L160 96 L160 160 L0 160 Z" fill="#2a3f5a" opacity="0.75" />
          <path d="M0 126 Q22 114 44 122 T88 118 T130 124 T160 116 L160 160 L0 160 Z" fill="#0e1a2a" />
          {/* tepede tek bir figür */}
          <g fill="#0e1a2a">
            <circle cx="46" cy="110.5" r="1.6" />
            <path d="M44.6 112.3 h2.8 l0.5 7 h-3.8 z" />
          </g>
        </svg>
      </div>
      <Vignette />
      <Grain />
    </>
  );
}

const BUILDINGS = [
  { x: 0, w: 14, h: 52 },
  { x: 14, w: 10, h: 70 },
  { x: 24, w: 16, h: 44 },
  { x: 40, w: 12, h: 86 },
  { x: 52, w: 18, h: 58 },
  { x: 70, w: 11, h: 76 },
  { x: 81, w: 15, h: 48 },
  { x: 96, w: 12, h: 92 },
  { x: 108, w: 17, h: 62 },
  { x: 125, w: 11, h: 80 },
  { x: 136, w: 24, h: 54 },
];

function MinimalBackdrop({ preset }: { preset: ScenePreset }) {
  const p = preset.palette;
  if (preset.variant === "paper") {
    return (
      <>
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${p.a}, ${p.b})` }} />
        {/* kesim işaretleri */}
        <div className="absolute left-[6%] top-[6%] size-[6cqw] border-l border-t" style={{ borderColor: p.d }} />
        <div className="absolute bottom-[6%] right-[6%] size-[6cqw] border-b border-r" style={{ borderColor: p.d }} />
      </>
    );
  }
  return (
    <>
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 120%, ${p.c}38, transparent 60%), ${p.a}` }} />
      <div className="absolute inset-x-[30%] bottom-[7%] flex h-[5cqw] items-end justify-center gap-[1cqw]">
        {[0.6, 1, 0.75, 0.9, 0.5, 0.85, 0.65].map((h, i) => (
          <span
            key={i}
            className="w-[1.2cqw] origin-bottom animate-[eq_1.1s_ease-in-out_infinite] rounded-full"
            style={{ height: `${h * 100}%`, background: p.accent, opacity: 0.7, animationDelay: `${i * -0.17}s` }}
          />
        ))}
      </div>
    </>
  );
}

function Performer({ color, rim, studio }: { color: string; rim: string; studio?: boolean }) {
  return (
    <svg viewBox="0 0 100 120" className="size-full" aria-hidden>
      <g fill={color}>
        <circle cx="50" cy="30" r="11.5" />
        <path d="M41 42 Q50 47 59 42 L65 47 Q76 53 78 72 L82 120 L18 120 L22 72 Q24 53 35 47 Z" />
        {studio ? (
          <>
            {/* kulaklık */}
            <path d="M38 28 Q38 15 50 15 Q62 15 62 28" stroke={color} strokeWidth="3" fill="none" />
            <rect x="34.5" y="25" width="5" height="9" rx="2.5" />
            <rect x="60.5" y="25" width="5" height="9" rx="2.5" />
            {/* mikrofon ve stand */}
            <rect x="70" y="24" width="9" height="15" rx="4.5" />
            <rect x="73.5" y="39" width="2" height="81" />
          </>
        ) : (
          <>
            <path d="M63 50 Q74 45 69 33 L64.5 33.5 Q66.5 42 60 46 Z" />
            <rect x="60.5" y="25" width="6" height="10" rx="3" transform="rotate(-18 63.5 30)" />
          </>
        )}
      </g>
      <g fill="none" stroke={rim} strokeWidth="0.9" opacity="0.65">
        <path d="M61.5 30 A11.5 11.5 0 0 0 50 18.5" />
        <path d="M65 47 Q76 53 78 72 L80 100" />
      </g>
    </svg>
  );
}

function ClipBackdrop({ preset, animate }: { preset: ScenePreset; animate: boolean }) {
  const p = preset.palette;
  if (preset.variant === "studio") {
    return (
      <>
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 75% 25%, ${p.c}66, transparent 45%), linear-gradient(180deg, ${p.b}, ${p.a})` }} />
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: `repeating-linear-gradient(90deg, ${p.d}22 0 2px, transparent 2px 9%)` }}
        />
        <div className="absolute bottom-0 left-[38%] h-[62%] w-[52%]">
          <Performer color="#0a0604" rim={p.c} studio />
        </div>
        <Vignette />
        <Grain />
      </>
    );
  }
  return (
    <>
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 100%, ${p.c}55, transparent 60%), linear-gradient(180deg, ${p.a}, ${p.b})` }} />
      {[
        { left: "18%", delay: "0s", color: p.d },
        { left: "50%", delay: "-1.6s", color: "#ffffff" },
        { left: "82%", delay: "-3.1s", color: p.accent },
      ].map((b, i) => (
        <span
          key={i}
          className={cn("pointer-events-none absolute -top-[10%] h-[95%] w-[22%] origin-top -translate-x-1/2 opacity-30 blur-[1.5cqw]", animate && "animate-[beam-sweep_6s_ease-in-out_infinite]")}
          style={{
            left: b.left,
            animationDelay: b.delay,
            background: `linear-gradient(180deg, ${b.color}cc, transparent 85%)`,
            clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)",
          }}
        />
      ))}
      <div className="absolute bottom-[4%] left-1/2 h-[52%] w-[46%] -translate-x-1/2">
        <Performer color="#07030d" rim={p.d} />
      </div>
      {/* kalabalık */}
      <svg viewBox="0 0 100 14" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[12%] w-full" aria-hidden>
        <path
          d="M0 14 L0 8 Q3 3 6 8 Q9 2 12 8 Q15 4 18 8 Q21 1 24 8 Q27 4 30 8 Q33 2 36 8 Q39 5 42 8 Q45 1 48 8 Q51 4 54 8 Q57 2 60 8 Q63 5 66 8 Q69 1 72 8 Q75 4 78 8 Q81 2 84 8 Q87 5 90 8 Q93 2 96 8 Q98 5 100 8 L100 14 Z"
          fill="#05020a"
        />
      </svg>
      <Vignette />
      <Grain />
    </>
  );
}
