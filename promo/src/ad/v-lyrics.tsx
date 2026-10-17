import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { fadeUp, pop, progress } from "../anim";
import { LyricMini, type LyricKind } from "../components/lyric-mini";
import { Highlight, Icon, Logo } from "../components/ui";
import { C, FONT, SHADOW } from "../theme";
import { AD_H, AD_W, COL, SAFE } from "./safe";

/**
 * Kanca (ilk 2–3 sn): arka planda tarzlar ritimle değişir, ilk karede ana mesaj okunur.
 * cycle: her arka planın kaç kare kaldığı.
 */
export function VHook({ duration, cycle }: { duration: number; cycle: number }) {
  const frame = useCurrentFrame();
  const kinds: LyricKind[] = ["film", "clip", "minimal"];
  const k = Math.min(kinds.length - 1, Math.floor(frame / cycle));
  const local = frame - k * cycle;
  const punch = 1.07 - 0.07 * progress(local, 0, 8);
  const card = pop(frame, -4, 13, 220);
  const chip = Math.min(1, pop(frame, Math.round(cycle * 0.9), 13, 180));

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${punch})` }}>
        <LyricMini kind={kinds[k]!} frame={local + 22} w={AD_W} lineDur={duration + 60} badge={false} textTop={0.55} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgb(0 0 0 / 0.28) 0%, transparent 45%)" }} />

      <div
        style={{
          position: "absolute",
          left: COL.left,
          width: COL.width,
          top: SAFE.top + 10,
          borderRadius: 44,
          background: "#fff",
          padding: "40px 44px 44px",
          boxShadow: "0 30px 80px -30px rgb(0 0 0 / 0.55)",
          transform: `scale(${0.9 + Math.min(card, 1.05) * 0.1})`,
          opacity: Math.min(1, card * 1.6),
        }}
      >
        <Logo size={34} />
        <div style={{ marginTop: 26, fontFamily: FONT.display, fontWeight: 800, color: C.ink, letterSpacing: "-0.03em", lineHeight: 1.02 }}>
          <div style={{ fontSize: 88, ...fadeUp(frame, -2, 30, 6) }}>Şarkın için</div>
          <div style={{ fontSize: 134, margin: "6px 0", ...fadeUp(frame, 0, 30, 6) }}>
            <Highlight progress={progress(frame, 5, 9)}>her ay 30</Highlight>
          </div>
          <div style={{ fontSize: 88, ...fadeUp(frame, 2, 30, 6) }}>lyrics video.</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 860,
          left: 0,
          width: AD_W,
          display: "flex",
          justifyContent: "center",
          opacity: chip,
          transform: `translateY(${(1 - chip) * 40}px)`,
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "20px 34px", borderRadius: 99, background: C.lime, boxShadow: SHADOW.lime, fontFamily: FONT.sans, fontWeight: 800, fontSize: 44, color: C.ink, marginLeft: -20 }}>
          <Icon name="users" size={44} color={C.ink} strokeWidth={2.4} />
          Gerçek editörler hazırlar
        </div>
      </div>
    </AbsoluteFill>
  );
}

const STYLES: { kind: LyricKind; name: string; desc: string; lineIdx: number; light?: boolean }[] = [
  { kind: "film", name: "Film Edit", desc: "Sinematik görüntüler, film atmosferi", lineIdx: 2 },
  { kind: "minimal", name: "Minimal", desc: "Sade zemin, güçlü tipografi", lineIdx: 2, light: true },
  { kind: "clip", name: "Music Video", desc: "Kendi klibinin üzerine senkron sözler", lineIdx: 2 },
];

/** Üç tarz, TikTok akışında kaydırır gibi alttan gelerek tam ekran oynar. */
export function VStyles({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const per = duration / STYLES.length;
  return (
    <AbsoluteFill>
      {STYLES.map((s, i) => {
        const start = i * per;
        if (frame < start - 1 || frame >= start + per + 10) return null;
        const local = frame - start;
        const slide = i === 0 ? 1 : progress(local, 0, 10);
        const lineDur = Math.round(per + 30);
        const ink = s.light ? C.ink : "#fff";
        const shadow = s.light ? "none" : "0 4px 24px rgb(0 0 0 / 0.55)";
        return (
          <AbsoluteFill key={s.kind} style={{ transform: `translateY(${(1 - slide) * AD_H}px)`, zIndex: i }}>
            <LyricMini kind={s.kind} frame={local + s.lineIdx * lineDur} w={AD_W} lineDur={lineDur} badge={false} textTop={0.42} />
            <div style={{ position: "absolute", left: COL.left, top: SAFE.top + 10, display: "flex", flexDirection: "column", gap: 14, ...fadeUp(frame, start + 4, 30, 10) }}>
              <span style={{ alignSelf: "flex-start", padding: "10px 22px", borderRadius: 99, background: s.light ? "rgb(23 32 51 / 0.08)" : "rgb(255 255 255 / 0.16)", fontFamily: FONT.sans, fontWeight: 800, fontSize: 32, color: ink, letterSpacing: "0.02em" }}>
                Tarz {i + 1}/3
              </span>
              <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 104, lineHeight: 1, color: ink, letterSpacing: "-0.03em", textShadow: shadow }}>{s.name}</span>
            </div>
            <div style={{ position: "absolute", left: COL.left, width: COL.width, top: SAFE.bottom - 110, display: "flex", alignItems: "center", gap: 18, fontFamily: FONT.sans, fontWeight: 700, fontSize: 42, color: ink, textShadow: shadow, ...fadeUp(frame, start + 10, 24, 10) }}>
              <span style={{ width: 16, height: 16, borderRadius: 16, background: C.lime, flexShrink: 0 }} />
              {s.desc}
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
}
