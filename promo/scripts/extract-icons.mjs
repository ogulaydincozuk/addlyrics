// Sitede kullanılan lucide ikonlarının çizim verisini (ISC lisanslı) videoya kopyalar.
//   node scripts/extract-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, "..", "..", "node_modules", "lucide-react", "dist", "esm", "icons");
const NAMES = [
  "check", "music", "music-4", "folder-up", "package", "package-check", "wand-sparkles", "calendar-check",
  "circle-play", "download", "message-square-text", "messages-square", "shield-check", "lock", "credit-card",
  "users", "sparkles", "palette", "layout-dashboard", "circle-plus", "list-music", "file-stack", "settings",
  "film", "type", "clapperboard", "arrow-right", "mouse-pointer-2", "badge-check", "gift", "receipt",
  "smartphone", "monitor", "square", "clock", "bell", "user-check", "file-audio", "file-text", "video",
  "upload", "calendar-days", "zap", "heart", "headphones", "pen-line", "send", "chevron-down", "arrow-down",
];

const DATA_RE = /const __iconData = (\{[\s\S]*?\});\s*\n__iconData/;
const ALIAS_RE = /from '\.\/(.+?)\.mjs'/;

function readIcon(name) {
  let src = readFileSync(join(iconsDir, `${name}.mjs`), "utf8");
  // Yeniden adlandırılan ikonlar başka bir dosyaya yönlendirir
  for (let i = 0; i < 3 && !src.includes("__iconData"); i++) {
    const alias = src.match(ALIAS_RE);
    if (!alias) break;
    src = readFileSync(join(iconsDir, `${alias[1]}.mjs`), "utf8");
  }
  const m = src.match(DATA_RE);
  if (!m) throw new Error(`İkon okunamadı: ${name}`);
  const { node } = Function(`return (${m[1]})`)();
  return node.map(([tag, attrs]) => {
    const { key: _key, ...rest } = attrs;
    return [tag, rest];
  });
}

const out = Object.fromEntries(NAMES.map((name) => [name, readIcon(name)]));
const header = `// Otomatik üretildi: scripts/extract-icons.mjs\n// Lucide ikon verisi — ISC lisansı, Copyright (c) Lucide Icons and Contributors\n`;
writeFileSync(join(here, "..", "src", "icon-data.ts"), `${header}export const ICONS = ${JSON.stringify(out)} as const;\n`);
console.log(`${NAMES.length} ikon yazıldı.`);
