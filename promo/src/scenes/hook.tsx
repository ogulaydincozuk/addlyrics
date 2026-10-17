import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, exitStyle, fadeUp, progress } from "../anim";
import { C, FONT } from "../theme";

const LINES = [
  { text: "Gerçek editörler.", start: 46 },
  { text: "Şarkına özel tasarım.", start: 80 },
  { text: "Planlı aylık teslim.", start: 114 },
];
const SWEEP = 28;

/** Lyrics videosu gibi karaoke dolgusuyla ilerleyen üç ana mesaj. */
export function Hook({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const strike = progress(frame, 22, 16);
  const topDim = interpolate(frame, [40, 56], [1, 0.45], CLAMP);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...exitStyle(frame, duration) }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 46 }}>
        <div style={{ position: "relative", fontFamily: FONT.sans, fontWeight: 600, fontSize: 44, color: C.inkSoft, opacity: topDim, ...fadeUp(frame, 0, 24) }}>
          Her video için ayrı ayrı editör aramakla uğraşma.
          <div style={{ position: "absolute", left: -10, right: -10, top: "54%", height: 5, borderRadius: 4, background: C.ink, transformOrigin: "left", transform: `scaleX(${strike})` }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          {LINES.map((l) => (
            <KaraokeLine key={l.text} text={l.text} start={l.start} frame={frame} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function KaraokeLine({ text, start, frame }: { text: string; start: number; frame: number }) {
  const appear = progress(frame, start - 12, 16);
  const fill = interpolate(frame, [start, start + SWEEP], [0, 100], CLAMP);
  const active = frame >= start - 4 && frame <= start + SWEEP + 4;
  const bounce = Math.abs(Math.sin(((frame - start) / SWEEP) * Math.PI * 3)) * 26;
  return (
    <div style={{ position: "relative", opacity: appear, transform: `translateY(${(1 - appear) * 30}px)` }}>
      <div
        style={{
          fontFamily: FONT.display,
          fontWeight: 800,
          fontSize: 124,
          lineHeight: 1.15,
          letterSpacing: "-0.035em",
          backgroundImage: `linear-gradient(90deg, ${C.ink} ${fill}%, ${C.lineStrong} ${fill}%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          padding: "0 8px",
        }}
      >
        {text}
      </div>
      {active && (
        <div
          style={{
            position: "absolute",
            top: 2 - bounce,
            left: `calc(${fill}% - 12px)`,
            width: 24,
            height: 24,
            borderRadius: 24,
            background: C.lime,
            boxShadow: `0 0 0 3px ${C.ink}`,
          }}
        />
      )}
    </div>
  );
}
