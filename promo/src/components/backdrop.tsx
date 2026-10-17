import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP, easeInOut } from "../anim";
import { C } from "../theme";

/** Tüm video boyunca süren açık tema arka plan: yumuşak lime ışıklar + hafif noktalı ızgara. */
export function Backdrop() {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const x1 = 78 + Math.sin(t * 0.35) * 8;
  const y1 = 4 + Math.cos(t * 0.3) * 6;
  const x2 = 6 + Math.cos(t * 0.28) * 7;
  const y2 = 96 + Math.sin(t * 0.33) * 5;
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(55% 55% at ${x1}% ${y1}%, ${C.brandSoft} 0%, transparent 70%), radial-gradient(45% 50% at ${x2}% ${y2}%, ${C.brandTint} 0%, transparent 70%), radial-gradient(35% 40% at 50% 120%, #eef6c4 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${C.lineStrong} 1.4px, transparent 1.4px)`,
          backgroundSize: "36px 36px",
          backgroundPosition: `${(frame * 0.25) % 36}px ${(frame * 0.12) % 36}px`,
          opacity: 0.45,
          maskImage: "radial-gradient(70% 70% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(70% 70% at 50% 50%, black 30%, transparent 100%)",
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Sahne geçişi: logodaki lime renginde eğik bir panel ekranı soldan sağa süpürür.
 * Kesme anı (at) panelin ekranı tamamen kapladığı karedir.
 */
export function Wipe({ at, half = 11 }: { at: number; half?: number }) {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  if (frame < at - half - 2 || frame > at + half + 2) return null;
  // eğik panelin üst/alt uçlarındaki yatay kayma; dikey videoda daha geniş panel gerekir
  const skew = Math.tan((12 * Math.PI) / 180) * (H / 2 + 40) + 80;
  const panel = W + skew * 2 + 160;
  // girişte panel soldan gelir, çıkışta sağa gider
  const inP = interpolate(frame, [at - half, at], [0, 1], { ...CLAMP, easing: easeInOut });
  const outP = interpolate(frame, [at, at + half], [0, 1], { ...CLAMP, easing: easeInOut });
  const left = frame <= at ? interpolate(inP, [0, 1], [-panel - skew, -(panel - W) / 2]) : interpolate(outP, [0, 1], [-(panel - W) / 2, W + skew]);
  // koyu şerit girişte panelin önünde, çıkışta arkasında görünür
  const trail = frame <= at ? left + 70 : left - 70;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 50 }}>
      <div style={{ position: "absolute", top: -40, bottom: -40, left: trail, width: panel, background: C.ink, transform: "skewX(-12deg)", opacity: 0.9 }} />
      <div style={{ position: "absolute", top: -40, bottom: -40, left, width: panel, background: C.lime, transform: "skewX(-12deg)" }} />
    </AbsoluteFill>
  );
}
