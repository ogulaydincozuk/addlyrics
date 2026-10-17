import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Backdrop, Wipe } from "./components/backdrop";
import { Delivery } from "./scenes/delivery";
import { Hook } from "./scenes/hook";
import { Intro } from "./scenes/intro";
import { Outro } from "./scenes/outro";
import { Packages } from "./scenes/packages";
import { Panel } from "./scenes/panel";
import { Steps } from "./scenes/steps";
import { Styles } from "./scenes/styles";
import { Trust } from "./scenes/trust";
import { Wizard } from "./scenes/wizard";
import { BAR } from "./theme";

type SceneDef = { name: string; bars: number; Component: React.FC<{ duration: number }>; wipe?: boolean };

// Süreler ölçü cinsinden (1 ölçü = 2 sn); müzik aynı ölçü çizelgesiyle üretilir (scripts/make-music.mjs).
export const SCENES: SceneDef[] = [
  { name: "Giriş", bars: 3, Component: Intro },
  { name: "Mesaj", bars: 3, Component: Hook },
  { name: "Video tarzları", bars: 6, Component: Styles, wipe: true },
  { name: "Nasıl çalışır", bars: 5, Component: Steps },
  { name: "Paketler", bars: 6, Component: Packages, wipe: true },
  { name: "Teslim planı", bars: 5, Component: Delivery },
  { name: "Sipariş sihirbazı", bars: 5, Component: Wizard },
  { name: "Müşteri paneli", bars: 6, Component: Panel, wipe: true },
  { name: "Güven", bars: 3, Component: Trust },
  { name: "Kapanış", bars: 4, Component: Outro, wipe: true },
];

export const TOTAL_FRAMES = SCENES.reduce((n, s) => n + s.bars * BAR, 0);

export function Promo({ withMusic }: { withMusic: boolean }) {
  let start = 0;
  const placed = SCENES.map((s) => {
    const from = start;
    start += s.bars * BAR;
    return { ...s, from, duration: s.bars * BAR };
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#f8fafc" }}>
      <Backdrop />
      {placed.map(({ name, from, duration, Component }) => (
        <Sequence key={name} name={name} from={from} durationInFrames={duration}>
          <Component duration={duration} />
        </Sequence>
      ))}
      {placed
        .filter((s) => s.wipe)
        .map((s) => (
          <Wipe key={`w-${s.name}`} at={s.from} />
        ))}
      {withMusic && <Audio src={staticFile("music.wav")} />}
    </AbsoluteFill>
  );
}
