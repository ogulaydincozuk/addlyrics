// Reklamlar için Türkçe erkek seslendirme üretir → public/voice/*.wav ve src/ad/voice-data.ts
// Ses: Windows'ta yüklü "Microsoft Tolga - Turkish" (scripts/tts-tolga.ps1).
// Her satır sahnesinin başında başlar; sığmazsa konuşma hızı otomatik artırılır.
//   node scripts/make-voice.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FPS = 30;
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const voiceDir = join(root, "public", "voice");
mkdirSync(voiceDir, { recursive: true });

// Marka adı ve "lyrics" Türkçe okunuşa göre yazıldı (Ed Liriks / liriks).
// at: başlama karesi, until: en geç bitmesi gereken kare (sonraki satır veya video sonu).
const SCRIPTS = {
  30: [
    { at: 4, until: 92, text: "Şarkın için, her ay otuz liriks video." },
    { at: 98, until: 268, text: "Film edit, minimal ya da klip üzerine sözler. Hepsi, gerçek editörlerin elinden." },
    { at: 274, until: 388, text: "Paketini seç, şarkını gönder. Gerisini ekibimiz halleder." },
    { at: 394, until: 568, text: "Paketler, üç bin iki yüz liradan başlıyor. Tek seferlik ödeme, otomatik yenileme yok." },
    { at: 574, until: 688, text: "Videoların, her ay düzenli olarak teslim edilir." },
    { at: 694, until: 808, text: "Tüm teslimlerin ve mesajların, tek bir panelde." },
    { at: 814, until: 896, text: "Ed Liriks. İlk paketini şimdi seç." },
  ],
  15: [
    { at: 3, until: 74, text: "Şarkın için, her ay otuz liriks video." },
    { at: 78, until: 196, text: "Film edit, minimal ya da klip. Hepsi gerçek editörlerden." },
    { at: 200, until: 316, text: "Üç bin iki yüz liradan başlayan paketler. Tek seferlik ödeme." },
    { at: 320, until: 376, text: "Her ay düzenli teslim." },
    { at: 380, until: 447, text: "Ed Liriks. İlk paketini şimdi seç." },
  ],
};

const BASE_RATE = 1.06;
const MAX_RATE = 1.3;

function synth(items) {
  const job = join(tmpdir(), `addlyrics-voice-${process.pid}.json`);
  writeFileSync(job, JSON.stringify(items), "utf8");
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(here, "tts-tolga.ps1"), "-Job", job], { stdio: "inherit" });
}

function readWav(file) {
  const b = readFileSync(file);
  const sr = b.readUInt32LE(24);
  const at = b.indexOf("data");
  const len = Math.min(b.readUInt32LE(at + 4), b.length - at - 8);
  const n = Math.floor(len / 2);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(at + 8 + i * 2) / 32768;
  return { sr, x };
}

/** Baş/son sessizliği kırpar, gövdeyi toparlar (alçak kesim + hafif sıkıştırma) ve normalize eder. */
function polish({ sr, x }) {
  const thr = 10 ** (-42 / 20);
  const win = Math.round(sr * 0.01);
  let s = 0;
  let e = x.length - 1;
  const loud = (i) => {
    let m = 0;
    for (let k = i; k < Math.min(x.length, i + win); k++) m = Math.max(m, Math.abs(x[k]));
    return m > thr;
  };
  while (s < x.length && !loud(s)) s += win;
  while (e > s && !loud(Math.max(0, e - win))) e -= win;
  const pad = Math.round(sr * 0.03);
  s = Math.max(0, s - pad);
  e = Math.min(x.length, e + pad);
  const y = x.slice(s, e);
  // 90 Hz alçak kesim
  const a = Math.exp((-2 * Math.PI * 90) / sr);
  let px = 0;
  let py = 0;
  for (let i = 0; i < y.length; i++) {
    const v = a * (py + y[i] - px);
    px = y[i];
    py = v;
    y[i] = v;
  }
  // basit sıkıştırıcı (yaklaşık 4:1, -24 dB eşik): telefon hoparlöründe anlaşılır kalsın
  let env = 0;
  const att = Math.exp(-1 / (sr * 0.005));
  const rel = Math.exp(-1 / (sr * 0.12));
  const t = 10 ** (-24 / 20);
  for (let i = 0; i < y.length; i++) {
    const lvl = Math.abs(y[i]);
    env = lvl > env ? att * env + (1 - att) * lvl : rel * env + (1 - rel) * lvl;
    if (env > t) y[i] *= (t * (env / t) ** (1 / 4)) / env;
  }
  // konuşulan bölümlerin ortalama seviyesini -13 dBFS'e getir; tepeleri aşağıdaki sınırlayıcı toplar
  let sum = 0;
  let count = 0;
  const gate = 10 ** (-40 / 20);
  for (const v of y) {
    if (Math.abs(v) > gate) {
      sum += v * v;
      count++;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, count));
  const g = 10 ** (-13 / 20) / (rms || 1);
  for (let i = 0; i < y.length; i++) y[i] *= g;
  // ileriye bakan tepe sınırlayıcı (tavan -1.5 dBFS, 3 ms ileri bakış, 60 ms bırakma)
  const ceil = 10 ** (-1.5 / 20);
  const look = Math.round(sr * 0.003);
  const release = 1 - Math.exp(-1 / (sr * 0.06));
  let gs = 1;
  const limited = new Float32Array(y.length);
  for (let i = 0; i < y.length; i++) {
    let p = 0;
    for (let k = i; k < Math.min(y.length, i + look); k++) p = Math.max(p, Math.abs(y[k]));
    const gd = p > ceil ? ceil / p : 1;
    gs = gd < gs ? gd : gs + (gd - gs) * release;
    limited[i] = y[i] * gs;
  }
  y.set(limited);
  // kısa giriş/çıkış yumuşatma
  const f = Math.round(sr * 0.008);
  for (let i = 0; i < f && i < y.length; i++) {
    y[i] *= i / f;
    y[y.length - 1 - i] *= i / f;
  }
  return { sr, x: y };
}

function writeWav(file, { sr, x }) {
  const data = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

const manifest = {};
for (const [cut, lines] of Object.entries(SCRIPTS)) {
  const rates = lines.map(() => BASE_RATE);
  const files = lines.map((_, i) => join(voiceDir, `ad${cut}-${i + 1}.wav`));
  let results = [];
  for (let pass = 0; pass < 3; pass++) {
    synth(lines.map((l, i) => ({ text: l.text, out: files[i], rate: rates[i] })));
    results = files.map((f) => polish(readWav(f)));
    let retry = false;
    lines.forEach((l, i) => {
      const slot = (l.until - l.at) / FPS;
      const dur = results[i].x.length / results[i].sr;
      if (dur > slot && rates[i] < MAX_RATE) {
        rates[i] = Math.min(MAX_RATE, rates[i] * (dur / slot) * 1.03);
        retry = true;
      }
    });
    if (!retry) break;
  }
  manifest[cut] = lines.map((l, i) => {
    writeWav(files[i], results[i]);
    const dur = results[i].x.length / results[i].sr;
    const frames = Math.ceil(dur * FPS);
    const fits = l.at + frames <= l.until;
    console.log(`${cut} sn #${i + 1}: ${dur.toFixed(2)} sn, hız ${rates[i].toFixed(2)}${fits ? "" : "  ⚠ yuvaya sığmadı"} — ${l.text}`);
    return { src: `voice/ad${cut}-${i + 1}.wav`, from: l.at, frames, text: l.text };
  });
}

const out = `// Otomatik üretildi: scripts/make-voice.mjs — elle düzenlemeyin\nexport type VoiceLine = { src: string; from: number; frames: number; text: string };\nexport const VOICE: Record<"30" | "15", VoiceLine[]> = ${JSON.stringify(manifest, null, 2)};\n`;
writeFileSync(join(root, "src", "ad", "voice-data.ts"), out, "utf8");
console.log("src/ad/voice-data.ts yazıldı.");
