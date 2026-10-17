import React from "react";
import { useCurrentFrame } from "remotion";
import { fadeUp } from "../anim";
import { ICONS } from "../icon-data";
import { C, FONT } from "../theme";

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color = "currentColor", strokeWidth = 2, style }: { name: IconName; size?: number; color?: string; strokeWidth?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {ICONS[name].map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

/** AddLyrics logosu: siyah rozet, beyaz "Add" + italik lime "Lyrics" (sitedeki Logo bileşeninin aynısı). */
export function Logo({ size = 40, addStyle, lyricsStyle, style }: { size?: number; addStyle?: React.CSSProperties; lyricsStyle?: React.CSSProperties; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        background: C.black,
        borderRadius: size * 0.3,
        padding: `${size * 0.3}px ${size * 0.42}px ${size * 0.24}px`,
        fontSize: size,
        lineHeight: 1,
        ...style,
      }}
    >
      <span style={{ fontFamily: FONT.sans, fontWeight: 900, letterSpacing: "-0.055em", color: "#fff", display: "inline-block", ...addStyle }}>Add</span>
      <span style={{ fontFamily: FONT.logo, fontStyle: "italic", fontWeight: 600, fontSize: "1.12em", marginLeft: "-0.04em", letterSpacing: "-0.01em", color: C.lime, display: "inline-block", ...lyricsStyle }}>
        Lyrics
      </span>
    </div>
  );
}

export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: C.black, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: FONT.logo, fontStyle: "italic", fontWeight: 600, fontSize: size * 0.62, color: C.lime, lineHeight: 1 }}>L</span>
    </div>
  );
}

/** Sitedeki bölüm üst başlığı: küçük nokta + etiket hapı */
export function Kicker({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 18px",
        borderRadius: 999,
        border: `1.5px solid ${C.brandSoft}`,
        background: "#fff",
        boxShadow: "0 1px 2px rgb(15 23 42 / 0.06)",
        fontFamily: FONT.sans,
        fontWeight: 700,
        fontSize: 20,
        color: C.brandInk,
        letterSpacing: "0.01em",
        ...style,
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 9, background: C.brand }} />
      {children}
    </div>
  );
}

/** Sahne başlığı: üst etiket + büyük başlık, sırayla belirir. */
export function SceneTitle({ kicker, title, start = 0, size = 64, align = "center" }: { kicker: string; title: React.ReactNode; start?: number; size?: number; align?: "center" | "left" }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", gap: 20, textAlign: align }}>
      <div style={fadeUp(frame, start, 20)}>
        <Kicker>{kicker}</Kicker>
      </div>
      <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: size, lineHeight: 1.08, color: C.ink, letterSpacing: "-0.02em", ...fadeUp(frame, start + 6, 40) }}>{title}</div>
    </div>
  );
}

/** Logodaki lime ile vurgulanan kelime (fosforlu kalem efekti) */
export function Highlight({ children, progress, color = C.lime }: { children: React.ReactNode; progress: number; color?: string }) {
  return (
    <span style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
      <span
        style={{
          position: "absolute",
          left: "-0.12em",
          right: "-0.12em",
          bottom: "0.06em",
          height: "0.5em",
          background: color,
          borderRadius: "0.12em",
          transformOrigin: "left center",
          transform: `scaleX(${progress}) skewX(-8deg)`,
          zIndex: 0,
        }}
      />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

export function Chip({ children, icon, active = true, style }: { children: React.ReactNode; icon?: IconName; active?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 20px",
        borderRadius: 14,
        background: active ? C.brandTint : "#fff",
        border: `1.5px solid ${active ? C.limeDeep : C.line}`,
        color: active ? C.brandInk : C.inkSoft,
        fontFamily: FONT.sans,
        fontWeight: 600,
        fontSize: 22,
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={22} color={active ? C.brand : C.muted} /> : null}
      {children}
    </div>
  );
}

/** Sitedeki lime ikon kutusu */
export function IconTile({ name, size = 64, style }: { name: IconName; size?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: C.lime,
        boxShadow: `${SHADOW_LIME}, inset 0 0 0 1.5px ${C.limeDeep}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <Icon name={name} size={size * 0.46} color={C.ink} />
    </div>
  );
}

const SHADOW_LIME = "0 10px 24px -12px rgb(150 190 20 / 0.85)";
