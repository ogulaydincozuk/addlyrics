import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, fadeUp, pop, progress } from "../anim";
import { Cursor } from "../components/devices";
import { Icon, Kicker, Logo } from "../components/ui";
import { C, FONT } from "../theme";

const CLICK = 104;

export function Outro({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const badge = pop(frame, 4, 11, 120);
  const lyrics = progress(frame, 18, 22);
  const pressed = frame >= CLICK && frame < CLICK + 6;
  const ripple = interpolate(frame, [CLICK, CLICK + 24], [0, 1], CLAMP);
  const fadeOut = interpolate(frame, [duration - 20, duration], [1, 0], CLAMP);
  const glow = 0.8 + Math.sin(frame / 10) * 0.2;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
      <div style={{ position: "absolute", width: 1100, height: 1100, borderRadius: "50%", background: `radial-gradient(circle, ${C.lime}70 0%, transparent 60%)`, opacity: glow * Math.min(1, badge), top: -120 }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34, marginTop: -40 }}>
        <div style={{ transform: `scale(${badge})` }}>
          <Logo
            size={120}
            lyricsStyle={{ clipPath: `inset(-20% ${(1 - lyrics) * 100}% -20% -5%)` }}
            style={{ boxShadow: "0 40px 80px -30px rgb(0 0 0 / 0.55)" }}
          />
        </div>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 84, letterSpacing: "-0.03em", color: C.ink, textAlign: "center", lineHeight: 1.08, ...fadeUp(frame, 34, 40) }}>
          Şarkın İçin İlk Paketini Seç.
        </div>
        <div style={{ fontFamily: FONT.sans, fontSize: 30, color: C.muted, fontWeight: 500, ...fadeUp(frame, 44, 30) }}>
          1, 2 veya 3 aylık paketler · 30, 60 veya 90 + 15 bonus video
        </div>
        <div style={{ position: "relative", ...fadeUp(frame, 56, 30) }}>
          {ripple > 0 && ripple < 1 && (
            <div style={{ position: "absolute", inset: -24 * ripple, borderRadius: 26, border: `4px solid ${C.limeDeep}`, opacity: 1 - ripple }} />
          )}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "24px 44px", borderRadius: 20, background: pressed ? C.limeDeep : C.lime, fontFamily: FONT.sans, fontWeight: 800, fontSize: 32, color: C.ink, boxShadow: "0 22px 44px -18px rgb(150 190 20 / 0.95)", transform: `scale(${pressed ? 0.95 : 1})` }}>
            Paketleri Keşfet <Icon name="arrow-right" size={32} color={C.ink} strokeWidth={2.5} />
          </div>
        </div>
        <div style={fadeUp(frame, 120, 20)}>
          <Kicker>Your Music. Your Lyrics. Your Visuals.</Kicker>
        </div>
      </div>
      <Cursor
        keys={[
          { f: 70, x: 1380, y: 900 },
          { f: CLICK - 6, x: 1080, y: 700 },
          { f: CLICK, x: 1080, y: 700, click: true },
          { f: CLICK + 40, x: 1150, y: 760 },
        ]}
      />
    </AbsoluteFill>
  );
}
