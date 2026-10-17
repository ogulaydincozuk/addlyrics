// Yerleşik stil önizlemeleri. Gerçek müşteri işi değildir; sözler AddLyrics için yazılmış
// özgün örnek satırlardır. Gerçek videolar admin panelinden portfolyoya yüklenir.

export type SceneKind = "film" | "minimal" | "clip";

export type ScenePreset = {
  id: string;
  kind: SceneKind;
  label: string;
  /** Her satırın ekranda kalma süresi (ms) */
  lineDuration: number;
  lines: string[];
  palette: { a: string; b: string; c: string; d: string; text: string; accent: string };
  variant: "dusk" | "night" | "mono" | "paper" | "stage" | "studio";
};

export const SCENE_PRESETS: Record<string, ScenePreset> = {
  "film-dusk": {
    id: "film-dusk",
    kind: "film",
    label: "Film Edit",
    variant: "dusk",
    lineDuration: 3400,
    lines: ["Şehir uyurken yazdım bu satırları", "Işıklar söner, sesim kalır geride", "Her nakarat bir adım daha ileri"],
    palette: { a: "#10263d", b: "#36597a", c: "#e48f66", d: "#f6c993", text: "#fff8ec", accent: "#ffd8a8" },
  },
  "film-night": {
    id: "film-night",
    kind: "film",
    label: "Film Edit",
    variant: "night",
    lineDuration: 3400,
    lines: ["Gece boyunca aynı sokaklar", "Kulaklıkta tek bir ses yankılanır", "Sabaha kadar bu şarkı benimle"],
    palette: { a: "#070b1f", b: "#1b2252", c: "#5b3a8c", d: "#f2a3c7", text: "#f4f1ff", accent: "#ffcf70" },
  },
  "minimal-mono": {
    id: "minimal-mono",
    kind: "minimal",
    label: "Minimal Lyrics",
    variant: "mono",
    lineDuration: 2600,
    lines: ["SÖZLER EKRANDA", "RİTİMLE BULUŞUR", "HER KELİME BİR VURUŞ"],
    palette: { a: "#0a0a0b", b: "#151518", c: "#dfff4c", d: "#efff9e", text: "#ffffff", accent: "#dfff4c" },
  },
  "minimal-paper": {
    id: "minimal-paper",
    kind: "minimal",
    label: "Minimal Lyrics",
    variant: "paper",
    lineDuration: 3000,
    lines: ["Sade bir zemin,", "net bir yazı,", "ve yalnızca senin sözlerin."],
    palette: { a: "#f6f1e8", b: "#efe7d8", c: "#172033", d: "#d9c7a7", text: "#172033", accent: "#607500" },
  },
  "clip-stage": {
    id: "clip-stage",
    kind: "clip",
    label: "Music Video",
    variant: "stage",
    lineDuration: 3200,
    lines: ["Sahne benim bu gece", "Işıkları kapat sesi aç", "Kalabalık tek bir nefes"],
    palette: { a: "#0d0618", b: "#2a0f3d", c: "#c026d3", d: "#f0abfc", text: "#ffffff", accent: "#fde047" },
  },
  "clip-studio": {
    id: "clip-studio",
    kind: "clip",
    label: "Music Video",
    variant: "studio",
    lineDuration: 3200,
    lines: ["Mikrofon açık kayıt başladı", "Her satırda biraz daha ben", "Bu ses benim hikâyem"],
    palette: { a: "#140c06", b: "#3b2412", c: "#f59e0b", d: "#fed7aa", text: "#fffaf0", accent: "#dfff4c" },
  },
};

export function getPreset(id: string | null | undefined): ScenePreset {
  return (id && SCENE_PRESETS[id]) || SCENE_PRESETS["film-dusk"]!;
}

export const ASPECT_CLASS = {
  VERTICAL: "aspect-[9/16]",
  HORIZONTAL: "aspect-video",
  SQUARE: "aspect-square",
} as const;
