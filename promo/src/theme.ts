import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

// Sitedeki fontlarla aynı aileler (src/app/layout.tsx)
const inter = loadInter("normal", { weights: ["400", "500", "600", "700", "800", "900"], subsets: ["latin", "latin-ext"] });
const jakarta = loadJakarta("normal", { weights: ["600", "700", "800"], subsets: ["latin", "latin-ext"] });
const playfair = loadPlayfair("italic", { weights: ["600", "700"], subsets: ["latin", "latin-ext"] });

export const FONT = {
  sans: `${inter.fontFamily}, system-ui, sans-serif`,
  display: `${jakarta.fontFamily}, ${inter.fontFamily}, sans-serif`,
  logo: `${playfair.fontFamily}, Georgia, serif`,
};

// Sitedeki renk tokenları (src/app/globals.css)
export const C = {
  canvas: "#f8fafc",
  card: "#ffffff",
  ink: "#172033",
  inkSoft: "#334155",
  muted: "#64748b",
  line: "#e2e8f0",
  lineStrong: "#cbd5e1",
  lime: "#dfff4c",
  limeDeep: "#c4e534",
  brand: "#607500",
  brandSoft: "#f1fcb8",
  brandTint: "#f9ffe0",
  brandInk: "#3b4700",
  black: "#000000",
  success: "#16a34a",
  successSoft: "#dcfce7",
  progress: "#4f46e5",
  progressSoft: "#e0e7ff",
};

export const SHADOW = {
  card: "0 1px 2px rgb(15 23 42 / 0.04), 0 12px 32px -12px rgb(15 23 42 / 0.16)",
  lift: "0 2px 4px rgb(15 23 42 / 0.05), 0 30px 60px -20px rgb(15 23 42 / 0.28)",
  lime: "0 18px 40px -14px rgb(150 190 20 / 0.75)",
};

export const FPS = 30;
/** 120 BPM: 1 vuruş = 15 kare, 1 ölçü = 60 kare. Sahneler müzikle birlikte ölçü başlarında değişir. */
export const BAR = 60;
export const BEAT = 15;
