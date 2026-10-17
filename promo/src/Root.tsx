import React from "react";
import { Composition } from "remotion";
import { AD15, AD30, AdPromo, totalFrames } from "./ad/AdPromo";
import { AD_H, AD_W } from "./ad/safe";
import { Promo, TOTAL_FRAMES } from "./Promo";
import { FPS } from "./theme";

export function Root() {
  return (
    <>
      <Composition id="AddLyricsTanitim" component={Promo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ withMusic: true }} />
      <Composition id="AddLyricsTanitimSessiz" component={Promo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ withMusic: false }} />
      {/* TikTok ve Instagram Reels reklamları (9:16) */}
      <Composition id="Reklam30" component={AdPromo} durationInFrames={totalFrames(AD30)} fps={FPS} width={AD_W} height={AD_H} defaultProps={{ cut: "30" as const, withMusic: true, withVoice: true, showSafe: false }} />
      <Composition id="Reklam15" component={AdPromo} durationInFrames={totalFrames(AD15)} fps={FPS} width={AD_W} height={AD_H} defaultProps={{ cut: "15" as const, withMusic: true, withVoice: true, showSafe: false }} />
    </>
  );
}
