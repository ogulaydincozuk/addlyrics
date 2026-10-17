import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, fadeUp, pop, progress, tl } from "../anim";
import { Icon, IconTile, Kicker, type IconName } from "../components/ui";
import { C, FONT, SHADOW } from "../theme";
import { COL, SAFE } from "./safe";
import { VideoStrip } from "./strip";

/** Dikey sahne başlığı: üst etiket + büyük başlık (güvenli alanın en üstünde). */
export function VTitle({ kicker, children, size = 92, start = 0 }: { kicker: string; children: React.ReactNode; size?: number; start?: number }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: COL.left, width: COL.width, top: SAFE.top, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={fadeUp(frame, start, 20, 10)}>
        <Kicker style={{ fontSize: 30, padding: "10px 22px" }}>{kicker}</Kicker>
      </div>
      <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.03em", color: C.ink, ...fadeUp(frame, start + 3, 34, 12) }}>{children}</div>
    </div>
  );
}

const STEPS: { icon: IconName; title: string; desc: string }[] = [
  { icon: "package", title: "Paketini seç", desc: "1, 2 veya 3 aylık" },
  { icon: "folder-up", title: "Şarkını gönder", desc: "Dosyanı ve sözlerini yükle" },
  { icon: "messages-square", title: "Editörlerimiz hazırlar", desc: "Önce sorularımızı sorarız" },
  { icon: "package-check", title: "Her ay teslim al", desc: "Panelinden izle ve indir" },
];

export function VSteps({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const gap = Math.max(8, Math.round((duration - 50) / STEPS.length));
  return (
    <AbsoluteFill>
      <VideoStrip />
      <VTitle kicker="4 adımda">Nasıl çalışır?</VTitle>
      <div style={{ position: "absolute", left: COL.left, width: COL.width, top: 520, display: "flex", flexDirection: "column", gap: 22 }}>
        {STEPS.map((s, i) => {
          const p = Math.min(1, pop(frame, 8 + i * gap, 13, 170));
          const active = frame >= 8 + i * gap;
          return (
            <div key={s.title} style={{ height: 160, display: "flex", alignItems: "center", gap: 26, padding: "0 30px", borderRadius: 32, background: "#fff", border: `2px solid ${active ? C.limeDeep : C.line}`, boxShadow: SHADOW.card, opacity: p, transform: `translateX(${(1 - p) * -120}px)` }}>
              <IconTile name={s.icon} size={92} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 46, color: C.ink, lineHeight: 1.1 }}>{s.title}</div>
                <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 32, color: C.muted, fontWeight: 500 }}>{s.desc}</div>
              </div>
              <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 64, color: active ? C.brand : C.brandSoft }}>{i + 1}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

const PACKAGES = [
  { name: "1 Aylık", price: 3200, videos: "30 video", bonus: 0, perVideo: 106.67 },
  { name: "2 Aylık", price: 6200, videos: "60 video", bonus: 0, perVideo: 103.33 },
  { name: "3 Aylık", price: 9400, videos: "90 video", bonus: 15, perVideo: 89.52, featured: true },
];

export function VPackages({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const spotAt = Math.round(duration * 0.5);
  const spot = interpolate(frame, [spotAt, spotAt + 10], [0, 1], CLAMP);
  const stamp = pop(frame, spotAt + 6, 9, 170);
  return (
    <AbsoluteFill>
      <VideoStrip offset={120} />
      <VTitle kicker="Paketler" size={80}>
        ₺3.200&apos;den başlayan
        <br />
        lyrics video paketleri
      </VTitle>
      <div style={{ position: "absolute", left: COL.left, width: COL.width, top: 580, display: "flex", flexDirection: "column", gap: 22 }}>
        {PACKAGES.map((p, i) => {
          const delay = 6 + i * 7;
          const e = Math.min(1, pop(frame, delay, 14, 160));
          const count = progress(frame, delay + 4, 20);
          const featured = Boolean(p.featured);
          return (
            <div
              key={p.name}
              style={{
                position: "relative",
                height: 168,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 34px",
                borderRadius: 32,
                background: "#fff",
                border: featured ? `4px solid ${C.limeDeep}` : `2px solid ${C.line}`,
                boxShadow: featured ? `${SHADOW.lift}, 0 0 0 ${10 * spot}px ${C.lime}66` : SHADOW.card,
                opacity: e * (featured ? 1 : 1 - spot * 0.45),
                transform: `translateY(${(1 - e) * 120}px) scale(${featured ? 1 + spot * 0.04 : 1 - spot * 0.03})`,
                zIndex: featured ? 2 : 1,
              }}
            >
              {featured && (
                <span style={{ position: "absolute", top: -24, left: 30, padding: "8px 20px", borderRadius: 99, background: C.lime, border: `2px solid ${C.limeDeep}`, fontFamily: FONT.sans, fontWeight: 800, fontSize: 26, color: C.ink }}>En avantajlı</span>
              )}
              <div>
                <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 50, color: C.ink }}>{p.name}</div>
                <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 10, fontFamily: FONT.sans, fontSize: 32, fontWeight: 700, color: C.inkSoft }}>
                  <Icon name="circle-play" size={30} color={C.brand} />
                  {p.videos}
                  {p.bonus > 0 && <span style={{ padding: "3px 12px", borderRadius: 99, background: C.successSoft, color: C.success, fontSize: 28, fontWeight: 800 }}>+{p.bonus} bonus</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 66, letterSpacing: "-0.03em", color: C.ink }}>{tl(Math.round((p.price * count) / 10) * 10)}</div>
                <div style={{ fontFamily: FONT.sans, fontSize: 26, fontWeight: 600, color: featured ? C.success : C.muted }}>{tl(p.perVideo, 2)} / video</div>
              </div>
              {featured && (
                <div style={{ position: "absolute", left: 420, top: 25, width: 118, height: 118, borderRadius: 118, background: C.ink, color: C.lime, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FONT.display, fontWeight: 800, lineHeight: 1, opacity: Math.min(1, stamp), transform: `scale(${1.8 - Math.min(stamp, 1.1) * 0.8}) rotate(${-12 + stamp * 2}deg)` }}>
                  <span style={{ fontSize: 40 }}>+15</span>
                  <span style={{ fontSize: 18, letterSpacing: "0.08em" }}>BONUS</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: COL.left, width: COL.width, top: 1160, display: "flex", justifyContent: "center", gap: 14, ...fadeUp(frame, 24, 20, 10) }}>
        {["Tek seferlik ödeme", "Otomatik yenileme yok"].map((t) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 20px", borderRadius: 16, background: C.brandTint, border: `2px solid ${C.limeDeep}`, fontFamily: FONT.sans, fontWeight: 700, fontSize: 28, color: C.brandInk }}>
            <Icon name="check" size={26} color={C.brand} strokeWidth={3} />
            {t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}

const BATCHES = [
  { label: "1. ay", count: 30, bonus: 0 },
  { label: "2. ay", count: 30, bonus: 0 },
  { label: "3. ay", count: 45, bonus: 15 },
];
const TILE_COLORS = ["#1b2252", "#5b3a8c", "#e48f66", "#efe7d8", "#3b2412", "#f59e0b", "#172033"];

export function VDelivery({ duration, compact = false }: { duration: number; compact?: boolean }) {
  const frame = useCurrentFrame();
  const fillLen = compact ? 14 : 26;
  const stepGap = compact ? 8 : 22;
  const noteAt = compact ? Math.round(duration * 0.45) : Math.round(duration * 0.55);
  return (
    <AbsoluteFill>
      <VideoStrip offset={300} />
      <VTitle kicker="Teslim planı" size={86}>
        Her ayın 1&apos;inde
        <br />
        düzenli teslim.
      </VTitle>
      <div style={{ position: "absolute", left: COL.left, width: COL.width, top: 560, height: 482, borderRadius: 34, background: "#fff", border: `2px solid ${C.line}`, boxShadow: SHADOW.card, padding: "22px 26px", ...fadeUp(frame, 2, 40, 10) }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 26, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase" }}>3 Aylık Paket · 105 video</div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-around", alignItems: "flex-end", height: 392 }}>
          {BATCHES.map((b, i) => {
            const start = 4 + i * stepGap;
            const filled = Math.round(interpolate(frame, [start, start + fillLen], [0, b.count], CLAMP));
            return (
              <div key={b.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 58, color: filled ? C.ink : C.lineStrong, lineHeight: 1 }}>{filled}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 36px)", gap: 6, alignContent: "end", height: 9 * 20 + 8 * 6 }}>
                  {Array.from({ length: b.count }, (_, k) => {
                    const idx = b.count - 1 - k;
                    const on = idx < filled;
                    const isBonus = b.bonus > 0 && idx >= b.count - b.bonus;
                    return <div key={k} style={{ width: 36, height: 20, borderRadius: 5, background: isBonus ? C.success : TILE_COLORS[(idx + i * 3) % TILE_COLORS.length], opacity: on ? 1 : 0.08 }} />;
                  })}
                </div>
                <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 32, color: C.ink }}>{b.label}</div>
                <div style={{ height: 30, fontFamily: FONT.sans, fontWeight: 700, fontSize: 24, color: C.success }}>{b.bonus ? `+${b.bonus} bonus` : ""}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: COL.left, width: COL.width, top: 1062, display: "flex", alignItems: "center", gap: 22, padding: "22px 26px", borderRadius: 28, background: C.brandTint, border: `2px solid ${C.limeDeep}`, ...fadeUp(frame, noteAt, 24, 10) }}>
        <span style={{ width: 70, height: 70, borderRadius: 20, background: C.lime, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="zap" size={38} color={C.ink} />
        </span>
        <div style={{ fontFamily: FONT.sans, fontSize: 31, lineHeight: 1.3, color: C.inkSoft }}>
          Ayın 1–15&apos;i arasında alırsan <b style={{ color: C.ink }}>ilk 30 video 5 iş günü içinde.</b>
        </div>
      </div>
    </AbsoluteFill>
  );
}

