import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, easeInOut, exitStyle, fadeUp, pop } from "../anim";
import { IconTile, SceneTitle, type IconName } from "../components/ui";
import { C, FONT, SHADOW } from "../theme";

const STEPS: { icon: IconName; title: string; desc: string }[] = [
  { icon: "package", title: "Paketini seç.", desc: "İhtiyacına göre 1, 2 veya 3 aylık paketi seç." },
  { icon: "folder-up", title: "Şarkını gönder.", desc: "Şarkı dosyanı, sözlerini ve varsa müzik klibini yükle." },
  { icon: "messages-square", title: "Editörlerimiz hazırlasın.", desc: "Ekibimiz gerekli soruları sorar; tercihlerin netleşince üretim başlar." },
  { icon: "package-check", title: "Videolarını teslim al.", desc: "Tamamlanan videolarını panelinden görüntüle ve indir." },
];

const CARD_W = 380;
const GAP = 34;
const LEFT = (1920 - (CARD_W * 4 + GAP * 3)) / 2;
const TOP = 380;
const ACTIVATE = (i: number) => 54 + i * 46;

export function Steps({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const lineStart = LEFT + 28 + 36;
  const lineEnd = LEFT + (CARD_W + GAP) * 3 + 28 + 36;
  const head = interpolate(frame, [ACTIVATE(0), ACTIVATE(3)], [0, 1], { ...CLAMP, easing: easeInOut });
  const headX = lineStart + (lineEnd - lineStart) * head;

  return (
    <AbsoluteFill style={exitStyle(frame, duration)}>
      <div style={{ position: "absolute", top: 100, left: 0, right: 0 }}>
        <SceneTitle kicker="4 adımda" title="Nasıl Çalışır?" size={72} />
      </div>

      {/* bağlantı çizgisi */}
      <div style={{ position: "absolute", top: TOP - 46, left: lineStart, width: lineEnd - lineStart, height: 6, borderRadius: 6, background: C.line, opacity: fadeUp(frame, 30).opacity }} />
      <div style={{ position: "absolute", top: TOP - 46, left: lineStart, width: headX - lineStart, height: 6, borderRadius: 6, background: C.brand }} />
      <div style={{ position: "absolute", top: TOP - 57, left: headX - 14, width: 28, height: 28, borderRadius: 28, background: C.lime, boxShadow: `0 0 0 4px #fff, 0 0 0 6px ${C.brand}`, opacity: fadeUp(frame, 40).opacity }} />

      {STEPS.map((s, i) => {
        const enter = pop(frame, 12 + i * 6, 16, 120);
        const act = interpolate(frame, [ACTIVATE(i), ACTIVATE(i) + 10], [0, 1], CLAMP);
        const bump = pop(frame, ACTIVATE(i), 8, 220);
        const iconScale = act > 0 ? 0.85 + Math.min(bump, 1.2) * 0.15 : 1;
        return (
          <div
            key={s.title}
            style={{
              position: "absolute",
              top: TOP,
              left: LEFT + i * (CARD_W + GAP),
              width: CARD_W,
              height: 360,
              borderRadius: 28,
              padding: 28,
              background: act > 0.5 ? "#fff" : C.canvas,
              border: `2px solid ${act > 0.5 ? C.limeDeep : C.line}`,
              boxShadow: act > 0.5 ? SHADOW.lift : "none",
              opacity: Math.min(1, enter),
              transform: `translateY(${(1 - enter) * 120 - act * 14}px)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ transform: `scale(${iconScale})` }}>
                <IconTile name={s.icon} size={72} />
              </div>
              <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 64, color: act > 0.5 ? C.brand : C.brandSoft }}>{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div style={{ marginTop: 34, fontFamily: FONT.display, fontWeight: 800, fontSize: 32, lineHeight: 1.15, color: C.ink }}>{s.title}</div>
            <div style={{ marginTop: 14, fontFamily: FONT.sans, fontSize: 23, lineHeight: 1.45, color: C.muted }}>{s.desc}</div>
          </div>
        );
      })}

      <div style={{ position: "absolute", top: 830, left: 0, right: 0, textAlign: "center", fontFamily: FONT.sans, fontSize: 30, fontWeight: 600, color: C.inkSoft, ...fadeUp(frame, 214, 20) }}>
        Satın almadan teslimata kadar tüm süreç <span style={{ color: C.brand }}>tek bir panelden</span> ilerler.
      </div>
    </AbsoluteFill>
  );
}
