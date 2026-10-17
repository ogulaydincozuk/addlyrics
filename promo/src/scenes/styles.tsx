import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, exitStyle, fadeUp, pop } from "../anim";
import { Phone } from "../components/devices";
import { LyricMini, type LyricKind } from "../components/lyric-mini";
import { Chip, Icon, SceneTitle, type IconName } from "../components/ui";
import { C, FONT } from "../theme";

const STYLES: { kind: LyricKind; title: string; desc: string; icon: IconName; format: string }[] = [
  { kind: "film", title: "Film Edit Lyrics", desc: "Sinematik görüntüler ve film atmosferi", icon: "film", format: "9:16" },
  { kind: "minimal", title: "Minimal Lyrics", desc: "Sade zemin, güçlü tipografi", icon: "type", format: "9:16" },
  { kind: "clip", title: "Music Video Lyrics", desc: "Kendi klibinin üzerine senkron sözler", icon: "clapperboard", format: "9:16" },
];

const FOCUS_START = 96;
const FOCUS_LEN = 76;
const PHONE_W = 300;

export function Styles({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const focus = STYLES.map((_, i) => {
    const s = FOCUS_START + i * FOCUS_LEN;
    const e = i === STYLES.length - 1 ? duration : s + FOCUS_LEN;
    return interpolate(frame, [s - 10, s, e - 8, e], [0, 1, 1, i === STYLES.length - 1 ? 1 : 0], CLAMP);
  });
  const anyFocus = Math.max(...focus);

  return (
    <AbsoluteFill style={exitStyle(frame, duration)}>
      <div style={{ position: "absolute", top: 64, left: 0, right: 0 }}>
        <SceneTitle kicker="Video tarzları" title="Şarkına Hangi Görsel Tarz Yakışıyor?" size={60} />
      </div>

      <div style={{ position: "absolute", top: 268, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 130 }}>
        {STYLES.map((s, i) => {
          const enter = pop(frame, 14 + i * 7, 15, 110);
          const f = focus[i]!;
          const dim = anyFocus > 0 ? 1 - (anyFocus - f) * 0.5 : 1;
          const scale = 1 + f * 0.09 - (anyFocus - f) * 0.04;
          return (
            <div
              key={s.kind}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity: Math.min(1, enter) * dim,
                transform: `translateY(${(1 - enter) * 260 - f * 18}px) rotate(${(1 - enter) * (i - 1) * 8}deg) scale(${scale})`,
                zIndex: f > 0.5 ? 2 : 1,
              }}
            >
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", inset: -40, borderRadius: 80, background: `radial-gradient(circle, ${C.lime}aa 0%, transparent 65%)`, opacity: f }} />
                <Phone width={PHONE_W}>
                  <LyricMini kind={s.kind} frame={frame - 20 - i * 9} w={PHONE_W * 0.93} lineDur={52} format={s.format} />
                </Phone>
              </div>
              <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 12, fontFamily: FONT.display, fontWeight: 800, fontSize: 32, color: C.ink }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, background: f > 0.5 ? C.lime : C.brandTint, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={s.icon} size={24} color={C.ink} />
                </span>
                {s.title}
              </div>
              <div style={{ marginTop: 8, fontFamily: FONT.sans, fontSize: 22, color: C.muted, fontWeight: 500 }}>{s.desc}</div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", top: 960, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18, ...fadeUp(frame, 70, 20) }}>
        <Chip icon="smartphone">9:16 Dikey</Chip>
        <Chip icon="monitor">16:9 Yatay</Chip>
        <Chip icon="square">1:1 Kare</Chip>
        <Chip icon="circle-play" active={false}>Örnekleri sitede izle</Chip>
      </div>
    </AbsoluteFill>
  );
}
