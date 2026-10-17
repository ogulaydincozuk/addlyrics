import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, easeInOut, exitStyle, fadeUp, pop, progress } from "../anim";
import { Highlight, IconTile, Kicker, Logo, type IconName } from "../components/ui";
import { C, FONT } from "../theme";

const FLOATERS: { icon: IconName; x: number; y: number; delay: number; size: number; rot: number }[] = [
  { icon: "music", x: 250, y: 230, delay: 92, size: 92, rot: -10 },
  { icon: "film", x: 1560, y: 200, delay: 98, size: 84, rot: 8 },
  { icon: "type", x: 300, y: 760, delay: 104, size: 78, rot: 6 },
  { icon: "clapperboard", x: 1580, y: 740, delay: 110, size: 96, rot: -6 },
];

export function Intro({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const badge = pop(frame, 4, 11, 120);
  const lyricsReveal = progress(frame, 24, 22);
  const lift = interpolate(frame, [62, 86], [0, 1], { ...CLAMP, easing: easeInOut });
  const glow = interpolate(frame, [0, 40], [0, 1], CLAMP) * (0.85 + Math.sin(frame / 12) * 0.15);
  const headlineWords = ["Şarkın", "İçin", "Lyrics", "Videolar."];

  return (
    <AbsoluteFill style={{ ...exitStyle(frame, duration) }}>
      {FLOATERS.map((f) => {
        const p = pop(frame, f.delay, 12);
        const bob = Math.sin((frame + f.delay * 3) / 22) * 10;
        return (
          <div key={f.icon} style={{ position: "absolute", left: f.x, top: f.y + bob, transform: `scale(${p}) rotate(${f.rot * p}deg)`, opacity: Math.min(1, p) }}>
            <IconTile name={f.icon} size={f.size} />
          </div>
        );
      })}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", background: `radial-gradient(circle, ${C.lime}66 0%, transparent 60%)`, opacity: glow * (1 - lift * 0.5), transform: `translateY(${-lift * 150}px)` }} />
        <div style={{ transform: `translateY(${-lift * 190}px) scale(${1 - lift * 0.42})`, display: "flex" }}>
          <div style={{ transform: `scale(${badge})` }}>
            <Logo
              size={170}
              addStyle={{ opacity: progress(frame, 12, 14), transform: `translateY(${(1 - progress(frame, 12, 18)) * 40}px)` }}
              lyricsStyle={{ clipPath: `inset(-20% ${(1 - lyricsReveal) * 100}% -20% -5%)`, transform: `skewX(${(1 - lyricsReveal) * -10}deg)` }}
              style={{ boxShadow: "0 40px 80px -30px rgb(0 0 0 / 0.55)" }}
            />
          </div>
        </div>

        <div style={{ position: "absolute", top: 470, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
          <div style={fadeUp(frame, 74, 24)}>
            <Kicker>Your Music. Your Lyrics. Your Visuals.</Kicker>
          </div>
          <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 94, lineHeight: 1.05, color: C.ink, letterSpacing: "-0.03em", textAlign: "center" }}>
            <div>
              {headlineWords.map((w, i) => (
                <span key={w} style={{ display: "inline-block", marginRight: 26, ...fadeUp(frame, 84 + i * 5, 50, 20) }}>
                  {w}
                </span>
              ))}
            </div>
            <div style={{ ...fadeUp(frame, 108, 50, 20) }}>
              <Highlight progress={progress(frame, 120, 18)}>Tek Bir Yerden.</Highlight>
            </div>
          </div>
          <div style={{ display: "flex", gap: 34, fontFamily: FONT.sans, fontSize: 28, fontWeight: 500, color: C.muted, ...fadeUp(frame, 132, 20) }}>
            <span>Gerçek editörler</span>
            <span style={{ color: C.limeDeep }}>●</span>
            <span>Şarkına özel tasarım</span>
            <span style={{ color: C.limeDeep }}>●</span>
            <span>Planlı aylık teslim</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
