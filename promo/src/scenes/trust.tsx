import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { exitStyle, pop } from "../anim";
import { IconTile, SceneTitle, type IconName } from "../components/ui";
import { C, FONT, SHADOW } from "../theme";

// Yalnızca sitenin gerçekten sunduğu taahhütler (abartılı vaat, izlenme garantisi yok)
const POINTS: { icon: IconName; text: string }[] = [
  { icon: "users", text: "Gerçek editörler tarafından hazırlanır" },
  { icon: "palette", text: "Şarkına ve tercihlerine özel tasarlanır" },
  { icon: "calendar-check", text: "Paketine göre planlanan video teslimatı" },
  { icon: "receipt", text: "Tek seferlik ödeme, otomatik yenileme yok" },
  { icon: "shield-check", text: "Kart bilgilerin AddLyrics tarafından görülmez ve saklanmaz" },
  { icon: "lock", text: "Dosyalarına yalnızca sen ve AddLyrics ekibi erişir" },
];

export function Trust({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={exitStyle(frame, duration)}>
      <div style={{ position: "absolute", top: 150, left: 0, right: 0 }}>
        <SceneTitle kicker="Neden AddLyrics?" title={<>Sen müziğine odaklan.<br />Video sürecini biz üstlenelim.</>} size={62} />
      </div>
      <div style={{ position: "absolute", top: 500, left: 150, right: 150, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 30 }}>
        {POINTS.map((p, i) => {
          const s = Math.min(1, pop(frame, 22 + i * 6, 13, 150));
          return (
            <div key={p.text} style={{ display: "flex", alignItems: "center", gap: 20, padding: "36px 30px", borderRadius: 26, background: "#fff", border: `1.5px solid ${C.line}`, boxShadow: SHADOW.card, opacity: s, transform: `translateY(${(1 - s) * 50}px) scale(${0.9 + s * 0.1})` }}>
              <IconTile name={p.icon} size={72} />
              <span style={{ fontFamily: FONT.sans, fontSize: 26, fontWeight: 600, color: C.ink, lineHeight: 1.35 }}>{p.text}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
