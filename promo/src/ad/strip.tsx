import React from "react";
import { useCurrentFrame } from "remotion";
import { LyricMini, type LyricKind } from "../components/lyric-mini";
import { AD_W, SAFE } from "./safe";

const KINDS: LyricKind[] = ["film", "minimal", "clip", "film", "clip", "minimal", "film", "clip"];
const THUMB_W = 210;
const GAP = 24;

/**
 * Açık zeminli sahnelerin alt kısmında akan küçük lyrics video şeridi.
 * Uygulama arayüzünün kapladığı bölgededir; yalnızca görsel doku sağlar, bilgi taşımaz.
 */
export function VideoStrip({ offset = 0 }: { offset?: number }) {
  const frame = useCurrentFrame() + offset;
  const span = KINDS.length * (THUMB_W + GAP);
  const shift = (frame * 2.2) % span;
  const enter = Math.min(1, frame / 12);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: AD_W,
        top: SAFE.bottom + 70,
        height: (THUMB_W * 16) / 9,
        overflow: "hidden",
        opacity: 0.92 * enter,
        maskImage: "linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)",
      }}
    >
      {[0, 1].map((rep) =>
        KINDS.map((k, i) => {
          const x = rep * span + i * (THUMB_W + GAP) - shift;
          if (x > AD_W || x + THUMB_W < 0) return null;
          return (
            <div key={`${rep}-${i}`} style={{ position: "absolute", left: x, top: 0, width: THUMB_W, height: (THUMB_W * 16) / 9, borderRadius: 22, overflow: "hidden", transform: `rotate(${i % 2 ? 2 : -2}deg)`, boxShadow: "0 18px 40px -20px rgb(15 23 42 / 0.45)" }}>
              <LyricMini kind={k} frame={frame + i * 37} w={THUMB_W} lineDur={50} badge={false} />
            </div>
          );
        }),
      )}
    </div>
  );
}
