import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, exitStyle, fadeUp, pop, progress } from "../anim";
import { Icon, SceneTitle } from "../components/ui";
import { C, FONT, SHADOW } from "../theme";

// 3 aylık paket: 30 / 30 / 45 (son teslimde 15 bonus video). Kural: src/lib/delivery-plan.ts
const BATCHES = [
  { label: "1. teslim", when: "İlk teslim", count: 30, bonus: 0 },
  { label: "2. teslim", when: "Sonraki ayın 1'i", count: 30, bonus: 0 },
  { label: "3. teslim", when: "Sonraki ayın 1'i", count: 45, bonus: 15 },
];
const TILE_W = 34;
const TILE_H = 22;
const COLS = 5;
const TILE_COLORS = ["#1b2252", "#5b3a8c", "#e48f66", "#efe7d8", "#3b2412", "#f59e0b", "#172033"];

// Ekim 2026: 1 Ekim perşembe
const MONTH_OFFSET = 3;
const DAYS = 31;

export function Delivery({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={exitStyle(frame, duration)}>
      <div style={{ position: "absolute", top: 60, left: 0, right: 0 }}>
        <SceneTitle kicker="Teslim planı" title={<>Her ayın 1&apos;inde düzenli teslim.</>} size={62} />
      </div>

      {/* sol: teslim sütunları */}
      <div style={{ position: "absolute", left: 130, top: 250, width: 860, height: 700, borderRadius: 32, background: "#fff", border: `1.5px solid ${C.line}`, boxShadow: SHADOW.card, padding: 36, ...fadeUp(frame, 10, 40) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 30, color: C.ink }}>3 Aylık Paket</div>
          <div style={{ padding: "8px 16px", borderRadius: 99, background: C.brandTint, border: `1.5px solid ${C.brandSoft}`, fontFamily: FONT.sans, fontWeight: 700, fontSize: 20, color: C.brandInk }}>
            Toplam {Math.round(105 * progress(frame, 40, 150))} / 105 video
          </div>
        </div>
        <div style={{ marginTop: 30, display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 420 }}>
          {BATCHES.map((b, i) => {
            const start = 40 + i * 48;
            const filled = Math.round(interpolate(frame, [start, start + 40], [0, b.count], CLAMP));
            const rows = Math.ceil(b.count / COLS);
            return (
              <div key={b.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 52, color: filled > 0 ? C.ink : C.lineStrong }}>{filled}</div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, ${TILE_W}px)`, gap: 6, padding: 12, borderRadius: 18, background: C.canvas, border: `1.5px dashed ${C.lineStrong}`, height: rows * (TILE_H + 6) + 18, alignContent: "end" }}>
                  {Array.from({ length: b.count }, (_, k) => {
                    const idx = b.count - 1 - k; // alttan yukarı dolsun
                    const on = idx < filled;
                    const isBonus = b.bonus > 0 && idx >= b.count - b.bonus;
                    const p = on ? pop(frame, start + (idx / b.count) * 40, 12, 200) : 0;
                    return (
                      <div
                        key={k}
                        style={{
                          width: TILE_W,
                          height: TILE_H,
                          borderRadius: 6,
                          background: isBonus ? C.success : TILE_COLORS[(idx + i * 3) % TILE_COLORS.length],
                          opacity: Math.min(1, p),
                          transform: `scale(${Math.min(1.1, p)})`,
                          boxShadow: isBonus ? `0 0 0 2px ${C.successSoft}` : "none",
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 24, color: C.ink }}>{b.label}</div>
                  <div style={{ fontFamily: FONT.sans, fontSize: 18, color: b.bonus ? C.success : C.muted, fontWeight: 600 }}>{b.bonus ? `${b.count - b.bonus} + ${b.bonus} bonus` : b.when}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 12, fontFamily: FONT.sans, fontSize: 22, color: C.inkSoft, fontWeight: 500, ...fadeUp(frame, 190, 16) }}>
          <Icon name="calendar-check" size={26} color={C.brand} />
          Sonraki teslimler her zaman <b style={{ color: C.ink }}>ayın 1&apos;inde</b> yapılır.
        </div>
      </div>

      {/* sağ: satın alma tarihine göre ilk teslim */}
      <Calendar frame={frame} />
    </AbsoluteFill>
  );
}

function Calendar({ frame }: { frame: number }) {
  const early = 110;
  const late = 176;
  return (
    <div style={{ position: "absolute", left: 1030, top: 250, width: 760, height: 700, borderRadius: 32, background: "#fff", border: `1.5px solid ${C.line}`, boxShadow: SHADOW.card, padding: 36, ...fadeUp(frame, 20, 40) }}>
      <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 28, color: C.ink }}>İlk teslim ne zaman?</div>
      <div style={{ marginTop: 4, fontFamily: FONT.sans, fontSize: 19, color: C.muted }}>Satın aldığın güne göre değişir</div>
      <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontFamily: FONT.sans, fontWeight: 700, fontSize: 16, color: C.muted, paddingBottom: 4 }}>
            {d}
          </div>
        ))}
        {Array.from({ length: MONTH_OFFSET }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: DAYS }, (_, i) => {
          const day = i + 1;
          const isEarly = day <= 15;
          const t = isEarly ? early + (day - 1) * 2 : late + (day - 16) * 1.5;
          const on = progress(frame, t, 8);
          return (
            <div
              key={day}
              style={{
                height: 50,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT.sans,
                fontWeight: 700,
                fontSize: 19,
                background: on > 0.5 ? (isEarly ? C.lime : C.progressSoft) : C.canvas,
                color: on > 0.5 ? (isEarly ? C.ink : C.progress) : C.inkSoft,
                border: `1.5px solid ${on > 0.5 ? (isEarly ? C.limeDeep : "#c7d2fe") : C.line}`,
                transform: `scale(${1 + Math.sin(on * Math.PI) * 0.12})`,
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <Rule frame={frame} start={early + 30} color={C.lime} border={C.limeDeep} icon="zap" title="Ayın 1–15'i arasında" text="İlk 30 video 5 iş günü içinde" />
        <Rule frame={frame} start={late + 26} color={C.progressSoft} border="#c7d2fe" icon="calendar-days" title="16'sından sonra" text="İlk teslim izleyen ayın 1'inde" />
      </div>
    </div>
  );
}

function Rule({ frame, start, color, border, icon, title, text }: { frame: number; start: number; color: string; border: string; icon: "zap" | "calendar-days"; title: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderRadius: 16, background: "#fff", border: `1.5px solid ${C.line}`, ...fadeUp(frame, start, 20, 16) }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: color, border: `1.5px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={24} color={C.ink} />
      </span>
      <div style={{ fontFamily: FONT.sans, fontSize: 21, color: C.inkSoft }}>
        <b style={{ color: C.ink }}>{title}:</b> {text}
      </div>
    </div>
  );
}
