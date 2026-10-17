import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, exitStyle, fadeUp, pop, progress, tl } from "../anim";
import { Chip, Icon, SceneTitle } from "../components/ui";
import { C, FONT, SHADOW } from "../theme";

// Fiyatlar ve video sayıları sitedeki paketlerle aynı (prisma/seed.ts); video başına maliyet bonus dahil.
const PACKAGES = [
  { name: "1 Aylık Paket", months: 1, price: 3200, videos: 30, bonus: 0, perVideo: 106.67, saving: null as number | null, batches: [30] },
  { name: "2 Aylık Paket", months: 2, price: 6200, videos: 60, bonus: 0, perVideo: 103.33, saving: 3, batches: [30, 30] },
  { name: "3 Aylık Paket", months: 3, price: 9400, videos: 90, bonus: 15, perVideo: 89.52, saving: 16, batches: [30, 30, 45], featured: true },
];

const CARD_W = 470;
const GAP = 40;
const LEFT = (1920 - (CARD_W * 3 + GAP * 2)) / 2;
const SPOT = 196;

export function Packages({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const spot = interpolate(frame, [SPOT, SPOT + 14], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={exitStyle(frame, duration)}>
      <div style={{ position: "absolute", top: 56, left: 0, right: 0 }}>
        <SceneTitle kicker="Paketler" title="Sana Uygun Lyrics Video Paketini Seç." size={58} />
      </div>

      {PACKAGES.map((p, i) => {
        const delay = 16 + i * 8;
        const enter = pop(frame, delay, 15, 115);
        const count = progress(frame, delay + 12, 34);
        const featured = Boolean(p.featured);
        const dim = featured ? 1 : 1 - spot * 0.4;
        const scale = featured ? 1 + spot * 0.05 : 1 - spot * 0.03;
        const stamp = pop(frame, SPOT + 10, 9, 160);
        return (
          <div
            key={p.name}
            style={{
              position: "absolute",
              top: 236,
              left: LEFT + i * (CARD_W + GAP),
              width: CARD_W,
              height: 610,
              borderRadius: 30,
              background: "#fff",
              border: featured ? `3px solid ${C.limeDeep}` : `1.5px solid ${C.line}`,
              boxShadow: featured ? `${SHADOW.lift}, 0 0 0 ${8 * spot}px ${C.lime}55` : SHADOW.card,
              padding: "34px 34px 30px",
              opacity: Math.min(1, enter) * dim,
              transform: `translateY(${(1 - enter) * 200 - (featured ? 16 : 0)}px) scale(${scale})`,
              zIndex: featured ? 2 : 1,
            }}
          >
            {featured && (
              <div style={{ position: "absolute", top: -22, left: 34, padding: "8px 18px", borderRadius: 99, background: C.lime, border: `1.5px solid ${C.limeDeep}`, fontFamily: FONT.sans, fontWeight: 800, fontSize: 19, color: C.ink }}>
                En avantajlı
              </div>
            )}
            {featured && (
              <div
                style={{
                  position: "absolute",
                  top: -58,
                  right: -46,
                  width: 128,
                  height: 128,
                  borderRadius: 128,
                  background: C.ink,
                  color: C.lime,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT.display,
                  fontWeight: 800,
                  lineHeight: 1,
                  opacity: Math.min(1, stamp),
                  transform: `scale(${1.8 - Math.min(stamp, 1.1) * 0.8}) rotate(${-14 + stamp * 2}deg)`,
                  boxShadow: SHADOW.lift,
                }}
              >
                <span style={{ fontSize: 44 }}>+15</span>
                <span style={{ fontSize: 20, letterSpacing: "0.08em" }}>BONUS</span>
              </div>
            )}

            <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 32, color: C.ink }}>{p.name}</div>
            <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 19, color: C.muted }}>{p.months} ay boyunca düzenli lyrics video içeriği</div>

            <div style={{ marginTop: 24, display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 78, letterSpacing: "-0.03em", color: C.ink }}>{tl(Math.round((p.price * count) / 10) * 10)}</span>
              <span style={{ fontFamily: FONT.sans, fontSize: 19, color: C.muted, fontWeight: 600 }}>tek seferlik</span>
            </div>

            <div style={{ marginTop: 18, borderRadius: 18, background: C.brandTint, border: `1.5px solid ${C.brandSoft}`, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: FONT.display, fontWeight: 800, fontSize: 34, color: C.ink }}>
                <Icon name="circle-play" size={30} color={C.brand} />
                {Math.round(p.videos * count)} video
                {p.bonus > 0 && (
                  <span style={{ padding: "4px 12px", borderRadius: 99, background: C.successSoft, color: C.success, fontSize: 22, fontFamily: FONT.sans, fontWeight: 800 }}>+{p.bonus} bonus</span>
                )}
              </div>
              <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 20, color: C.inkSoft, fontWeight: 500 }}>
                Video başına <b style={{ color: C.ink }}>{tl(p.perVideo, 2)}</b>
              </div>
              <div style={{ marginTop: 4, height: 24, fontFamily: FONT.sans, fontSize: 17, color: C.success, fontWeight: 700 }}>
                {p.saving ? `1 aylık pakete göre %${p.saving} daha uygun` : ""}
              </div>
            </div>

            <div style={{ marginTop: 20, fontFamily: FONT.sans, fontSize: 17, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Aylık teslim</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              {p.batches.map((b, j) => (
                <span key={j} style={{ padding: "7px 13px", borderRadius: 10, background: j === 2 ? C.successSoft : C.canvas, border: `1.5px solid ${j === 2 ? "#bbf7d0" : C.line}`, fontFamily: FONT.sans, fontSize: 18, fontWeight: 700, color: j === 2 ? C.success : C.inkSoft, opacity: progress(frame, delay + 30 + j * 6, 10) }}>
                  {j + 1}. ay: {b}
                </span>
              ))}
            </div>

            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              {["Gerçek editörler tarafından hazırlanır", "Panelden teslim ve indirme"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT.sans, fontSize: 20, color: C.inkSoft }}>
                  <span style={{ width: 26, height: 26, borderRadius: 26, background: C.successSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="check" size={16} color={C.success} strokeWidth={3} />
                  </span>
                  {f}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ position: "absolute", top: 902, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18, ...fadeUp(frame, 120, 20) }}>
        <Chip icon="receipt">Tek seferlik ödeme</Chip>
        <Chip icon="badge-check">Otomatik yenileme yok</Chip>
        <Chip icon="sparkles">Video başına maliyet açık</Chip>
      </div>
    </AbsoluteFill>
  );
}
