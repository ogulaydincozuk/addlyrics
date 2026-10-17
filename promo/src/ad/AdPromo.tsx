import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Backdrop, Wipe } from "../components/backdrop";
import { SafeGuide } from "./safe";
import { VOICE, type VoiceLine } from "./voice-data";
import { VDelivery, VPackages, VSteps } from "./v-info";
import { VHook, VStyles } from "./v-lyrics";
import { VCta, VPanel } from "./v-panel-cta";

type Cut = { name: string; frames: number; render: (duration: number) => React.ReactNode; wipe?: boolean };

// 120 BPM: 15 kare = 1 vuruş. Kesmeler vuruşlara denk gelir; müzik aynı çizelgeyle üretilir (scripts/make-music.mjs).
export const AD30: Cut[] = [
  { name: "Kanca", frames: 90, render: (d) => <VHook duration={d} cycle={30} /> },
  { name: "Tarzlar", frames: 180, render: (d) => <VStyles duration={d} /> },
  { name: "Adımlar", frames: 120, render: (d) => <VSteps duration={d} /> },
  { name: "Paketler", frames: 180, render: (d) => <VPackages duration={d} />, wipe: true },
  { name: "Teslim", frames: 120, render: (d) => <VDelivery duration={d} /> },
  { name: "Panel", frames: 120, render: (d) => <VPanel duration={d} /> },
  { name: "Kapanış", frames: 90, render: (d) => <VCta duration={d} />, wipe: true },
];

export const AD15: Cut[] = [
  { name: "Kanca", frames: 60, render: (d) => <VHook duration={d} cycle={20} /> },
  { name: "Tarzlar", frames: 135, render: (d) => <VStyles duration={d} /> },
  { name: "Paketler", frames: 120, render: (d) => <VPackages duration={d} />, wipe: true },
  { name: "Teslim", frames: 60, render: (d) => <VDelivery duration={d} compact /> },
  { name: "Kapanış", frames: 75, render: (d) => <VCta duration={d} />, wipe: true },
];

export const totalFrames = (cuts: Cut[]) => cuts.reduce((n, c) => n + c.frames, 0);

/**
 * Müzik seviyesi: reklam neredeyse baştan sona konuşmalı olduğundan müzik genel olarak biraz kısıktır (0.7),
 * konuşma sırasında 0.22'ye iner; aradaki geçişler yumuşaktır.
 */
function musicVolume(frame: number, lines: VoiceLine[]) {
  const RAMP = 6;
  let duck = 0;
  for (const l of lines) {
    const a = l.from - RAMP;
    const b = l.from + l.frames + RAMP;
    if (frame <= a || frame >= b) continue;
    const env = Math.min(1, (frame - a) / RAMP, (b - frame) / RAMP);
    duck = Math.max(duck, env);
  }
  return 0.7 - duck * 0.48;
}

export function AdPromo({ cut, withMusic, withVoice = true, showSafe = false }: { cut: "30" | "15"; withMusic: boolean; withVoice?: boolean; showSafe?: boolean }) {
  const cuts = cut === "30" ? AD30 : AD15;
  const voice = withVoice ? VOICE[cut] : [];
  let start = 0;
  const placed = cuts.map((c) => {
    const from = start;
    start += c.frames;
    return { ...c, from };
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#f8fafc" }}>
      <Backdrop />
      {placed.map((c) => (
        <Sequence key={c.name} name={c.name} from={c.from} durationInFrames={c.frames}>
          {c.render(c.frames)}
        </Sequence>
      ))}
      {placed
        .filter((c) => c.wipe)
        .map((c) => (
          <Wipe key={`w-${c.name}`} at={c.from} half={8} />
        ))}
      {withMusic && <Audio src={staticFile(cut === "30" ? "music-ad30.wav" : "music-ad15.wav")} volume={(f) => musicVolume(f, voice)} />}
      {voice.map((l) => (
        <Sequence key={l.src} name={`Ses: ${l.text}`} from={l.from} durationInFrames={l.frames + 2} layout="none">
          <Audio src={staticFile(l.src)} />
        </Sequence>
      ))}
      {showSafe && <SafeGuide />}
    </AbsoluteFill>
  );
}
