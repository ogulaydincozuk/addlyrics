import React from "react";
import { AbsoluteFill } from "remotion";

export const AD_W = 1080;
export const AD_H = 1920;

/**
 * TikTok ve Instagram Reels arayüzünün (açıklama, profil, beğen/yorum butonları, reklam CTA'sı)
 * kapatmadığı bölge. Meta Reels reklamları için üstte ~%14, altta ~%35; TikTok'ta sağda ~140 px
 * boş bırakılması önerilir. Yazı ve logolar bu kutunun içinde tutulur.
 */
export const SAFE = { top: 280, bottom: 1240, left: 110, right: 950 };
export const COL = { left: SAFE.left, width: SAFE.right - SAFE.left };

/** Yalnızca kontrol için: güvenli alan dışını kırmızıyla gösterir (render edilen reklamda kapalıdır). */
export function SafeGuide() {
  const shade = "rgb(239 68 68 / 0.28)";
  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: SAFE.top, background: shade }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: SAFE.bottom, bottom: 0, background: shade }} />
      <div style={{ position: "absolute", left: 0, width: SAFE.left, top: SAFE.top, height: SAFE.bottom - SAFE.top, background: shade }} />
      <div style={{ position: "absolute", left: SAFE.right, right: 0, top: SAFE.top, height: SAFE.bottom - SAFE.top, background: shade }} />
    </AbsoluteFill>
  );
}
