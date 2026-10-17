import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./theme";

export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 ilerleme, verilen karede başlar. */
export function progress(frame: number, start: number, duration: number, easing = easeOut) {
  return interpolate(frame, [start, start + duration], [0, 1], { ...CLAMP, easing });
}

/** Yumuşak yaylı giriş (0→1, hafif taşma ile). */
export function pop(frame: number, delay = 0, damping = 14, stiffness = 140) {
  return spring({ frame: frame - delay, fps: FPS, config: { damping, stiffness, mass: 0.9 } });
}

/** Aşağıdan yukarı belirerek gelme stili. */
export function fadeUp(frame: number, start: number, distance = 36, duration = 22): React.CSSProperties {
  const p = progress(frame, start, duration);
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * distance}px)`,
    filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined,
  };
}

/** Sahne çıkışı: sona doğru hafif yukarı kayıp kaybolma. */
export function exitStyle(frame: number, duration: number, length = 14): React.CSSProperties {
  const p = progress(frame, duration - length, length, Easing.in(Easing.cubic));
  if (p <= 0) return {};
  return { opacity: 1 - p, transform: `translateY(${-p * 30}px) scale(${1 - p * 0.02})` };
}

/** Türkçe para biçimi: ₺3.200 veya ₺106,67 */
export function tl(value: number, decimals = 0) {
  return `₺${value.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
