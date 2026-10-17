import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { CLAMP, easeInOut } from "../anim";
import { C, FONT, SHADOW } from "../theme";
import { Icon } from "./ui";

/** 9:16 ekranlı telefon çerçevesi */
export function Phone({ width, children, style }: { width: number; children: React.ReactNode; style?: React.CSSProperties }) {
  const bezel = width * 0.035;
  const screenW = width - bezel * 2;
  const screenH = (screenW * 16) / 9;
  return (
    <div
      style={{
        width,
        height: screenH + bezel * 2,
        padding: bezel,
        borderRadius: width * 0.13,
        background: "linear-gradient(160deg, #2a2d34, #0b0c10 40%, #1c1e24)",
        boxShadow: `${SHADOW.lift}, inset 0 0 0 1.5px rgb(255 255 255 / 0.12)`,
        position: "relative",
        ...style,
      }}
    >
      <div style={{ width: screenW, height: screenH, borderRadius: width * 0.1, overflow: "hidden", position: "relative", background: "#000" }}>
        {children}
        <div style={{ position: "absolute", top: screenW * 0.03, left: "50%", width: screenW * 0.28, height: screenW * 0.075, marginLeft: -(screenW * 0.14), borderRadius: 99, background: "#000", zIndex: 5 }} />
      </div>
    </div>
  );
}

/** Açık temalı tarayıcı/uygulama penceresi */
export function Browser({ width, height, label, children, style }: { width: number; height: number; label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 26,
        background: C.card,
        border: `1.5px solid ${C.line}`,
        boxShadow: SHADOW.lift,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div style={{ height: 58, flexShrink: 0, display: "flex", alignItems: "center", gap: 18, padding: "0 22px", borderBottom: `1.5px solid ${C.line}`, background: "#fbfcfe" }}>
        <div style={{ display: "flex", gap: 9 }}>
          {["#f87171", "#fbbf24", "#a3e635"].map((c) => (
            <span key={c} style={{ width: 14, height: 14, borderRadius: 14, background: c, opacity: 0.85 }} />
          ))}
        </div>
        <div style={{ flex: 1, maxWidth: 560, height: 34, margin: "0 auto", borderRadius: 10, background: C.canvas, border: `1.5px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: FONT.sans, fontSize: 17, fontWeight: 500, color: C.muted }}>
          <Icon name="lock" size={15} color={C.muted} />
          {label}
        </div>
        <div style={{ width: 66 }} />
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

type CursorKey = { f: number; x: number; y: number; click?: boolean };

/** Ana karelere göre hareket eden fare imleci; click:true olan karede tıklama halkası çizer. */
export function Cursor({ keys }: { keys: CursorKey[] }) {
  const frame = useCurrentFrame();
  const frames = keys.map((k) => k.f);
  const x = interpolate(frame, frames, keys.map((k) => k.x), { ...CLAMP, easing: easeInOut });
  const y = interpolate(frame, frames, keys.map((k) => k.y), { ...CLAMP, easing: easeInOut });
  const click = keys.filter((k) => k.click).map((k) => k.f).reverse().find((f) => frame >= f && frame < f + 16);
  const pressed = click !== undefined && frame - click < 5;
  const ring = click !== undefined ? (frame - click) / 16 : 0;
  const visible = interpolate(frame, [keys[0]!.f - 6, keys[0]!.f], [0, 1], CLAMP);
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 40, pointerEvents: "none", opacity: visible }}>
      {click !== undefined && (
        <div
          style={{
            position: "absolute",
            left: -26 * (0.4 + ring),
            top: -26 * (0.4 + ring),
            width: 52 * (0.4 + ring),
            height: 52 * (0.4 + ring),
            borderRadius: 999,
            border: `3px solid ${C.brand}`,
            opacity: 1 - ring,
          }}
        />
      )}
      <svg width="38" height="38" viewBox="0 0 24 24" style={{ transform: `translate(-6px,-4px) scale(${pressed ? 0.86 : 1})`, filter: "drop-shadow(0 4px 6px rgb(0 0 0 / 0.3))" }}>
        <path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" fill={C.ink} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
