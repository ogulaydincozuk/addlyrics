import React from "react";
import { AbsoluteFill, interpolate, random } from "remotion";
import { CLAMP, easeOut } from "../anim";
import { FONT } from "../theme";

// Sitedeki stil önizlemeleriyle aynı özgün örnek sözler (src/components/lyrics/scene-presets.ts).
// Gerçek müşteri işi değildir.
export const PRESETS = {
  film: {
    label: "Film Edit",
    lines: ["Gece boyunca aynı sokaklar", "Kulaklıkta tek bir ses yankılanır", "Sabaha kadar bu şarkı benimle"],
    palette: { a: "#070b1f", b: "#1b2252", c: "#5b3a8c", d: "#f2a3c7", text: "#f4f1ff", accent: "#ffcf70" },
  },
  minimal: {
    label: "Minimal",
    lines: ["Sade bir zemin,", "net bir yazı,", "ve yalnızca senin sözlerin."],
    palette: { a: "#f6f1e8", b: "#efe7d8", c: "#172033", d: "#d9c7a7", text: "#172033", accent: "#607500" },
  },
  clip: {
    label: "Music Video",
    lines: ["Mikrofon açık kayıt başladı", "Her satırda biraz daha ben", "Bu ses benim hikâyem"],
    palette: { a: "#140c06", b: "#3b2412", c: "#f59e0b", d: "#fed7aa", text: "#fffaf0", accent: "#dfff4c" },
  },
} as const;

export type LyricKind = keyof typeof PRESETS;

/** Telefon/kart içinde oynayan küçük lyrics video sahnesi. frame: sahnenin yerel karesi, w: ekran genişliği. */
export function LyricMini({ kind, frame, w, lineDur = 54, format = "9:16", badge = true, textTop }: { kind: LyricKind; frame: number; w: number; lineDur?: number; format?: string; badge?: boolean; /** sözlerin dikey konumu (0–1) */ textTop?: number }) {
  const p = PRESETS[kind];
  const idx = Math.floor(Math.max(0, frame) / lineDur) % p.lines.length;
  const local = Math.max(0, frame) % lineDur;
  const Scene = kind === "film" ? FilmScene : kind === "minimal" ? MinimalScene : ClipScene;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Scene frame={frame} w={w} line={p.lines[idx]!} prev={p.lines[(idx + p.lines.length - 1) % p.lines.length]!} local={local} lineDur={lineDur} textTop={textTop} />
      {badge && (
        <div
          style={{
            position: "absolute",
            top: w * 0.13,
            left: w * 0.06,
            padding: `${w * 0.014}px ${w * 0.035}px`,
            borderRadius: 99,
            background: kind === "minimal" ? "rgb(23 32 51 / 0.08)" : "rgb(255 255 255 / 0.16)",
            color: kind === "minimal" ? "#172033" : "#fff",
            fontFamily: FONT.sans,
            fontWeight: 700,
            fontSize: w * 0.04,
            backdropFilter: "blur(6px)",
          }}
        >
          {p.label} · {format}
        </div>
      )}
    </AbsoluteFill>
  );
}

type SceneProps = { frame: number; w: number; line: string; prev: string; local: number; lineDur: number; textTop?: number };

function words(line: string) {
  return line.split(" ");
}

function FilmScene({ frame, w, line, local, lineDur, textTop = 0.41 }: SceneProps) {
  const p = PRESETS.film.palette;
  const t = frame / 30;
  const push = 1.04 + Math.sin(t * 0.4) * 0.03;
  const out = interpolate(local, [lineDur - 10, lineDur], [1, 0], CLAMP);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${p.a} 0%, ${p.b} 62%, ${p.c} 100%)` }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        {/* ışık sızıntısı */}
        <div style={{ position: "absolute", width: w * 1.4, height: w * 1.4, left: w * (-0.2 + Math.sin(t * 0.5) * 0.15), top: w * (0.9 + Math.cos(t * 0.4) * 0.1), borderRadius: "50%", background: `radial-gradient(circle, ${p.d}55 0%, transparent 65%)` }} />
        <div style={{ position: "absolute", width: w, height: w, right: -w * 0.4, top: w * 0.2, borderRadius: "50%", background: `radial-gradient(circle, ${p.accent}33 0%, transparent 60%)` }} />
        <Skyline w={w} frame={frame} />
      </AbsoluteFill>
      {/* sinematik siyah bantlar */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: w * 0.2, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: w * 0.2, background: "#000" }} />
      <Grain w={w} frame={frame} opacity={0.12} />
      <div style={{ position: "absolute", left: w * 0.08, right: w * 0.08, top: `${textTop * 100}%`, textAlign: "center", fontFamily: FONT.logo, fontStyle: "italic", fontWeight: 600, fontSize: w * 0.095, lineHeight: 1.18, color: p.text, opacity: out, textShadow: "0 4px 24px rgb(0 0 0 / 0.5)" }}>
        {words(line).map((word, i) => {
          const a = interpolate(local, [i * 4, i * 4 + 14], [0, 1], { ...CLAMP, easing: easeOut });
          return (
            <span key={i} style={{ display: "inline-block", marginRight: "0.25em", opacity: a, transform: `translateY(${(1 - a) * w * 0.03}px)`, filter: `blur(${(1 - a) * 6}px)` }}>
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function Skyline({ w, frame }: { w: number; frame: number }) {
  const buildings = Array.from({ length: 9 }, (_, i) => {
    const bw = w * (0.09 + random(`bw${i}`) * 0.08);
    const bh = w * (0.35 + random(`bh${i}`) * 0.55);
    return { bw, bh, x: (i / 9) * w * 1.1 - w * 0.05 };
  });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: w * 0.2, height: w }}>
      {buildings.map((b, i) => (
        <div key={i} style={{ position: "absolute", bottom: 0, left: b.x, width: b.bw, height: b.bh, background: "#05071a", borderTopLeftRadius: 2, borderTopRightRadius: 2 }}>
          {Array.from({ length: 10 }, (_, j) => {
            const on = random(`win${i}-${j}`) > 0.45;
            const flick = random(`fl${i}-${j}-${Math.floor(frame / 20)}`) > 0.93 ? 0.3 : 1;
            return on ? (
              <span key={j} style={{ position: "absolute", left: `${18 + (j % 3) * 28}%`, top: `${8 + Math.floor(j / 3) * 18}%`, width: "14%", height: w * 0.012, background: "#ffcf70", opacity: 0.55 * flick }} />
            ) : null;
          })}
        </div>
      ))}
    </div>
  );
}

function Grain({ w, frame, opacity }: { w: number; frame: number; opacity: number }) {
  const ox = Math.floor(random(`gx${frame}`) * 60);
  const oy = Math.floor(random(`gy${frame}`) * 60);
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, mixBlendMode: "overlay" }}>
      <filter id={`grain-${Math.round(w)}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 7} />
      </filter>
      <rect x={-ox} y={-oy} width="130%" height="130%" filter={`url(#grain-${Math.round(w)})`} />
    </svg>
  );
}

function MinimalScene({ w, line, prev, local, lineDur, textTop = 0.36 }: SceneProps) {
  const p = PRESETS.minimal.palette;
  const ws = words(line);
  const per = Math.min(9, (lineDur - 18) / ws.length);
  const prevOut = interpolate(local, [0, 14], [1, 0], CLAMP);
  const total = interpolate(local, [0, lineDur], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${p.a}, ${p.b})` }}>
      <div style={{ position: "absolute", left: w * 0.1, right: w * 0.08, top: `${textTop * 100}%`, fontFamily: FONT.display, fontWeight: 800, color: p.text, letterSpacing: "-0.02em" }}>
        <div style={{ fontSize: w * 0.075, color: "#a8a29e", opacity: prevOut * 0.9, marginBottom: w * 0.04, transform: `translateY(${-(1 - prevOut) * w * 0.05}px)` }}>{prev}</div>
        <div style={{ fontSize: w * 0.12, lineHeight: 1.08 }}>
          {ws.map((word, i) => {
            const a = interpolate(local, [i * per + 4, i * per + 10], [0, 1], { ...CLAMP, easing: easeOut });
            const isLast = i === ws.length - 1;
            return (
              <span key={i} style={{ display: "inline-block", marginRight: "0.22em", opacity: a, transform: `scale(${0.85 + a * 0.15})`, transformOrigin: "left bottom", position: "relative" }}>
                {word}
                {isLast && <span style={{ position: "absolute", left: 0, bottom: -w * 0.012, height: w * 0.014, width: `${a * 100}%`, background: p.accent, borderRadius: 4 }} />}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: w * 0.1, right: w * 0.1, bottom: w * 0.18, height: w * 0.008, background: "rgb(23 32 51 / 0.12)", borderRadius: 4 }}>
        <div style={{ width: `${total * 100}%`, height: "100%", background: p.text, borderRadius: 4 }} />
      </div>
    </AbsoluteFill>
  );
}

function ClipScene({ frame, w, line, local, lineDur, textTop = 0.3 }: SceneProps) {
  const p = PRESETS.clip.palette;
  const t = frame / 30;
  const ws = words(line).map((x) => x.toLocaleUpperCase("tr-TR"));
  const per = (lineDur - 8) / ws.length;
  const active = Math.min(ws.length - 1, Math.floor(local / per));
  const pulse = 0.85 + Math.sin(t * Math.PI * 4) * 0.15;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 35%, ${p.b} 0%, ${p.a} 70%)` }}>
      {/* sahne ışıkları */}
      <AbsoluteFill style={{ background: `conic-gradient(from ${180 + Math.sin(t * 0.8) * 18}deg at 50% -10%, transparent 0deg, ${p.c}40 8deg, transparent 18deg, transparent 32deg, ${p.d}30 40deg, transparent 50deg)`, filter: "blur(4px)" }} />
      {Array.from({ length: 10 }, (_, i) => {
        const x = random(`bx${i}`) * w;
        const y = ((random(`by${i}`) * 1.8 * w - t * w * 0.05 * (0.5 + random(`bs${i}`))) % (1.8 * w) + 1.8 * w) % (1.8 * w);
        const r = w * (0.05 + random(`br${i}`) * 0.1);
        return <div key={i} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: `radial-gradient(circle, ${i % 2 ? p.c : p.d}55, transparent 70%)` }} />;
      })}
      {/* sanatçı silueti (arkadan aydınlatılmış) */}
      <div style={{ position: "absolute", left: "50%", bottom: 0, width: w * 0.9, height: w * 0.9, marginLeft: -w * 0.45, borderRadius: "50%", background: `radial-gradient(circle at 50% 45%, ${p.c}${Math.round(pulse * 120).toString(16)} 0%, transparent 60%)` }} />
      <svg viewBox="0 0 100 100" style={{ position: "absolute", left: "50%", bottom: 0, width: w * 0.78, marginLeft: -w * 0.39 }}>
        <circle cx="50" cy="38" r="13" fill="#0a0603" />
        <path d="M14 100 C 16 70, 30 58, 50 56 C 70 58, 84 70, 86 100 Z" fill="#0a0603" />
        <rect x="47" y="44" width="5" height="12" rx="2.5" fill="#1a120a" transform="rotate(-18 50 50)" />
      </svg>
      <Grain w={w} frame={frame} opacity={0.08} />
      <div style={{ position: "absolute", left: w * 0.07, right: w * 0.07, top: `${textTop * 100}%`, textAlign: "center", fontFamily: FONT.display, fontWeight: 800, fontSize: w * 0.092, lineHeight: 1.25, color: p.text, letterSpacing: "-0.01em" }}>
        {ws.map((word, i) => {
          const a = interpolate(local, [i * per - 2, i * per + 4], [0, 1], CLAMP);
          const on = i === active;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: `0 ${w * 0.012}px ${w * 0.02}px`,
                padding: `0 ${w * 0.02}px`,
                borderRadius: w * 0.02,
                opacity: 0.35 + a * 0.65,
                color: on ? "#172033" : p.text,
                background: on ? p.accent : "transparent",
                transform: `scale(${on ? 1.06 : 1})`,
                textShadow: on ? "none" : "0 3px 16px rgb(0 0 0 / 0.6)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
