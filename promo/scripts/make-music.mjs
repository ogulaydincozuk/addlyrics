// Videolar için özgün (telifsiz) arka plan müziği üretir (120 BPM).
//   node scripts/make-music.mjs promo   → public/music.wav       (92 sn yatay tanıtım, src/Promo.tsx)
//   node scripts/make-music.mjs ad30    → public/music-ad30.wav  (30 sn dikey reklam, src/ad/AdPromo.tsx)
//   node scripts/make-music.mjs ad15    → public/music-ad15.wav  (15 sn dikey reklam)
// Sahne geçişleri ilgili videonun çizelgesiyle aynıdır; süre değişirse buradaki planı da güncelle.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM; // 0.5 sn
const BAR = BEAT * 4; // 2 sn

// Aralıklar ölçü cinsindendir: [başlangıç, bitiş)
const PLANS = {
  // Sahneler (ölçü): Giriş 0, Mesaj 3, Tarzlar 6, Adımlar 12, Paketler 17, Teslim 23, Sihirbaz 28, Panel 33, Güven 39, Kapanış 42
  promo: {
    file: "music.wav",
    bars: 46,
    kick: [[3, 39], [42, 44]],
    clap: [[4, 23], [25, 39], [42, 44]],
    hats: [[3, 39], [42, 44]],
    hats16: [[6, 39], [42, 44]],
    bass: [[3, 39], [42, 44]],
    pluck: [[1, 44]],
    sparse: [[0, 6], [39, 42]],
    padSoft: [[0, 3], [39, 42]],
    finalChordBar: 44,
    impacts: [[0.06, 0.4], [6], [17], [33], [42]],
    whooshes: [6, 17, 33, 42],
    risers: [[3, 1], [6, 1], [17, 1], [33, 1], [42, 1]],
    padCutoff: (bar) => (bar < 3 ? 400 + (bar / 3) * 1300 : bar >= 39 && bar < 42 ? 1100 : 1700),
    fadeOut: 2.2,
  },
  // Reklam: ilk kareden itibaren tam ritim. Kesmeler: 1.5, 4.5, 6.5, 9.5, 11.5, 13.5
  ad30: {
    file: "music-ad30.wav",
    bars: 15,
    kick: [[0, 15]],
    clap: [[0, 15]],
    hats: [[0, 15]],
    hats16: [[1.5, 15]],
    bass: [[0, 15]],
    pluck: [[0, 15]],
    sparse: [],
    padSoft: [],
    impacts: [[0, 0.5], [6.5], [13.5]],
    whooshes: [1.5, 4.5, 6.5, 9.5, 11.5, 13.5],
    risers: [[6.5, 0.5], [13.5, 0.5]],
    padCutoff: () => 1700,
    fadeOut: 0.35,
  },
  // Kesmeler: 1, 3.25, 5.25, 6.25
  ad15: {
    file: "music-ad15.wav",
    bars: 7.5,
    kick: [[0, 7.5]],
    clap: [[0, 7.5]],
    hats: [[0, 7.5]],
    hats16: [[1, 7.5]],
    bass: [[0, 7.5]],
    pluck: [[0, 7.5]],
    sparse: [],
    padSoft: [],
    impacts: [[0, 0.5], [3.25], [6.25]],
    whooshes: [1, 3.25, 5.25, 6.25],
    risers: [[3.25, 0.5], [6.25, 0.5]],
    padCutoff: () => 1700,
    fadeOut: 0.3,
  },
};

const PLAN_NAME = process.argv[2] ?? "promo";
const PLAN = PLANS[PLAN_NAME];
if (!PLAN) throw new Error(`Bilinmeyen plan: ${PLAN_NAME} (${Object.keys(PLANS).join(", ")})`);
const BARS = PLAN.bars;
const LEN = Math.round(BARS * BAR * SR);
const inRanges = (ranges, pos) => ranges.some(([a, b]) => pos >= a && pos < b);

const L = new Float32Array(LEN);
const R = new Float32Array(LEN);
const padBus = [new Float32Array(LEN), new Float32Array(LEN)];
const pluckBus = new Float32Array(LEN);
const reverbSend = new Float32Array(LEN);

let seed = 1234567;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const idx = (t) => Math.round(t * SR);

class Biquad {
  constructor(type, freq, q = 0.707) {
    this.type = type;
    this.q = q;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(freq);
  }
  set(freq) {
    const w = (2 * Math.PI * Math.min(freq, SR * 0.45)) / SR;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * this.q);
    let b0, b1, b2;
    if (this.type === "lp") [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
    else if (this.type === "hp") [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    else [b0, b1, b2] = [alpha, 0, -alpha]; // bp
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// --- düzen -----------------------------------------------------------------
// Am – F – C – G
const CHORDS = [
  { bass: 33, notes: [57, 60, 64] },
  { bass: 29, notes: [53, 57, 60] },
  { bass: 36, notes: [55, 60, 64] },
  { bass: 31, notes: [55, 59, 62] },
];
const chordAt = (bar) => CHORDS[bar % 4];

// pos: ölçü cinsinden konum (ör. 6.25 = 7. ölçünün 2. vuruşu)
const has = {
  kick: (pos) => inRanges(PLAN.kick, pos),
  clap: (pos) => inRanges(PLAN.clap, pos),
  hats: (pos) => inRanges(PLAN.hats, pos),
  hats16: (pos) => inRanges(PLAN.hats16, pos),
  bass: (pos) => inRanges(PLAN.bass, pos),
  pluck: (pos) => inRanges(PLAN.pluck, pos),
};

const kickTimes = [];

function kick(t0, gain = 0.95) {
  kickTimes.push(t0);
  const n = idx(0.45);
  let phase = 0;
  const s = idx(t0);
  for (let i = 0; i < n && s + i < LEN; i++) {
    const t = i / SR;
    const f = 44 + 120 * Math.exp(-t * 30);
    phase += (2 * Math.PI * f) / SR;
    const v = Math.sin(phase) * Math.exp(-t * 7) * gain + (i < 120 ? noise() * 0.12 * (1 - i / 120) : 0);
    L[s + i] += v;
    R[s + i] += v;
  }
}

function clap(t0, gain = 0.32) {
  const bp = new Biquad("bp", 1500, 0.9);
  const n = idx(0.3);
  const s = idx(t0);
  for (let i = 0; i < n && s + i < LEN; i++) {
    const t = i / SR;
    let env = Math.exp(-t * 16);
    for (const o of [0, 0.011, 0.022]) if (t >= o && t < o + 0.008) env += 0.8;
    const v = bp.process(noise()) * env * gain * 2.2;
    L[s + i] += v * 0.95;
    R[s + i] += v;
    reverbSend[s + i] += v * 0.35;
  }
}

function hat(t0, gain = 0.09, open = false) {
  const hp = new Biquad("hp", 7500, 0.8);
  const n = idx(open ? 0.22 : 0.05);
  const s = idx(t0);
  const pan = rnd() * 0.3;
  for (let i = 0; i < n && s + i < LEN; i++) {
    const t = i / SR;
    const v = hp.process(noise()) * Math.exp(-t * (open ? 14 : 70)) * gain;
    L[s + i] += v * (1 - pan);
    R[s + i] += v * (0.7 + pan);
  }
}

function bassNote(t0, midi, dur, gain = 0.32) {
  const lp = new Biquad("lp", 520, 0.9);
  const f = mtof(midi);
  const n = idx(dur + 0.05);
  const s = idx(t0);
  let ph = 0;
  for (let i = 0; i < n && s + i < LEN; i++) {
    const t = i / SR;
    ph += f / SR;
    const tri = 1 - 4 * Math.abs((ph % 1) - 0.5);
    const sine = Math.sin(2 * Math.PI * ph);
    const env = Math.min(1, t / 0.004) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.05)) * Math.exp(-t * 2.2);
    const v = lp.process(Math.tanh((sine * 0.8 + tri * 0.5) * 1.6)) * env * gain;
    L[s + i] += v;
    R[s + i] += v;
  }
}

function padChord(t0, notes, dur, gain = 0.045) {
  const s = idx(t0);
  const n = idx(dur + 0.6);
  const voices = [];
  for (const m of notes)
    for (const [d, pan] of [
      [-0.09, 0.15],
      [0, 0.5],
      [0.09, 0.85],
    ])
      voices.push({ f: mtof(m) * 2 ** (d / 12), ph: rnd(), pan });
  for (let i = 0; i < n && s + i < LEN; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.35) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.6));
    let l = 0;
    let r = 0;
    for (const v of voices) {
      v.ph += v.f / SR;
      const saw = 2 * (v.ph % 1) - 1;
      l += saw * (1 - v.pan);
      r += saw * v.pan;
    }
    padBus[0][s + i] += l * env * gain;
    padBus[1][s + i] += r * env * gain;
  }
}

// Karplus–Strong telli çalgı tınısı
function pluck(t0, midi, gain = 0.22, decay = 0.996) {
  const f = mtof(midi);
  const period = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(period);
  for (let i = 0; i < period; i++) buf[i] = noise();
  const s = idx(t0);
  const n = idx(0.6);
  let p = 0;
  let prev = 0;
  for (let i = 0; i < n && s + i < LEN; i++) {
    const cur = buf[p];
    const next = buf[(p + 1) % period];
    const v = decay * 0.5 * (cur + next);
    buf[p] = v;
    p = (p + 1) % period;
    const out = (cur * 0.7 + prev * 0.3) * gain * Math.exp(-(i / SR) * 3);
    prev = cur;
    pluckBus[s + i] += out;
  }
}

function riser(endBar, bars = 1, gain = 0.16) {
  const t0 = (endBar - bars) * BAR;
  const dur = bars * BAR;
  const bp = new Biquad("bp", 300, 1.4);
  const s = idx(t0);
  const n = idx(dur);
  for (let i = 0; i < n && s + i < LEN; i++) {
    const x = i / n;
    if (i % 64 === 0) bp.set(250 + 6500 * x * x);
    const v = bp.process(noise()) * x ** 2.2 * gain * 3;
    L[s + i] += v * (0.8 + 0.2 * Math.sin(x * 20));
    R[s + i] += v * (0.8 + 0.2 * Math.cos(x * 20));
    reverbSend[s + i] += v * 0.2;
  }
}

function impact(t0, gain = 0.55) {
  const lp = new Biquad("lp", 3000, 0.7);
  const s = idx(t0);
  const n = idx(1.8);
  let ph = 0;
  for (let i = 0; i < n && s + i < LEN; i++) {
    const t = i / SR;
    ph += (40 + 30 * Math.exp(-t * 6)) / SR;
    if (i % 64 === 0) lp.set(200 + 5000 * Math.exp(-t * 3));
    const boom = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.4) * gain;
    const air = lp.process(noise()) * Math.exp(-t * 2.8) * gain * 0.45;
    L[s + i] += boom + air;
    R[s + i] += boom + air * 0.9;
    reverbSend[s + i] += air * 0.5;
  }
}

function whoosh(tCut, gain = 0.12) {
  const bp = new Biquad("bp", 800, 1.2);
  const t0 = tCut - 0.4;
  const s = idx(t0);
  const n = idx(0.6);
  for (let i = 0; i < n && s + i < LEN; i++) {
    const x = i / n;
    if (i % 64 === 0) bp.set(500 + 4000 * Math.sin(x * Math.PI));
    const env = Math.sin(x * Math.PI) ** 2;
    const v = bp.process(noise()) * env * gain * 3;
    L[s + i] += v * (1 - x);
    R[s + i] += v * x;
  }
}

// --- notaları yerleştir ------------------------------------------------------
const FINAL = PLAN.finalChordBar ?? Infinity;
for (let b = 0; b < Math.ceil(BARS); b++) {
  const t = b * BAR;
  const ch = chordAt(b);
  if (b < FINAL) padChord(t, ch.notes, BAR - 0.05, inRanges(PLAN.padSoft, b) ? 0.05 : 0.04);
  else if (b === FINAL) padChord(t, CHORDS[0].notes, BAR * 2 - 0.6, 0.05);

  for (let beat = 0; beat < 4; beat++) {
    const tb = t + beat * BEAT;
    const pos = b + beat / 4;
    if (has.kick(pos)) kick(tb);
    if (has.clap(pos) && (beat === 1 || beat === 3)) clap(tb);
    if (has.hats(pos)) {
      hat(tb + BEAT / 2, 0.1, beat === 3 && b % 2 === 1);
      if (has.hats16(pos)) {
        hat(tb + BEAT / 4, 0.045);
        hat(tb + (BEAT * 3) / 4, 0.045);
      }
    }
    if (has.bass(pos)) bassNote(tb + BEAT / 2, ch.bass + 12 * (beat === 3 && b % 2 ? 1 : 0), BEAT * 0.42);
  }

  // 16'lık arpej; giriş ve ara bölümde daha seyrek
  const tones = [...ch.notes.map((m) => m + 12), ch.notes[0] + 24];
  const pattern = [0, 2, 1, 3, 2, 1, 0, 2, 3, 1, 2, 0, 1, 3, 2, 1];
  const sparse = inRanges(PLAN.sparse, b);
  for (let k = 0; k < 16; k++) {
    if (!has.pluck(b + k / 16)) continue;
    if (sparse && k % 2 === 1) continue;
    if (!sparse && (k === 5 || k === 13)) continue;
    pluck(t + k * (BEAT / 4), tones[pattern[k] % tones.length], k % 4 === 0 ? 0.26 : 0.19);
  }
}
if (Number.isFinite(FINAL)) {
  // son akor ve kuyruk
  pluck(FINAL * BAR, 69, 0.3, 0.998);
  pluck(FINAL * BAR + 0.02, 76, 0.24, 0.998);
}

for (const [end, bars] of PLAN.risers) riser(end, bars);
for (const at of PLAN.whooshes) whoosh(at * BAR);
for (const [at, gain] of PLAN.impacts) impact(at * BAR, gain);

// --- karıştır ----------------------------------------------------------------
// Pad: alçak geçiren filtre (girişte açılan) + kick'e göre ducking
kickTimes.sort((a, b) => a - b);
const padLp = [new Biquad("lp", 400, 0.8), new Biquad("lp", 400, 0.8)];
let k = 0;
for (let i = 0; i < LEN; i++) {
  const t = i / SR;
  while (k + 1 < kickTimes.length && kickTimes[k + 1] <= t) k++;
  const since = kickTimes.length && kickTimes[k] <= t ? t - kickTimes[k] : 10;
  const duck = 1 - 0.6 * Math.exp(-since * 9);
  if (i % 128 === 0) {
    const cutoff = PLAN.padCutoff(t / BAR);
    padLp[0].set(cutoff);
    padLp[1].set(cutoff);
  }
  const pl = padLp[0].process(padBus[0][i]) * duck;
  const pr = padLp[1].process(padBus[1][i]) * duck;
  L[i] += pl;
  R[i] += pr;
  reverbSend[i] += (pl + pr) * 0.25;
}

// Pluck: ping-pong gecikme (3/16)
{
  const d = idx(BEAT * 0.75);
  const dl = new Float32Array(LEN);
  const dr = new Float32Array(LEN);
  for (let i = 0; i < LEN; i++) {
    const x = pluckBus[i];
    const inL = i >= d ? dr[i - d] * 0.38 : 0;
    const inR = i >= d ? dl[i - d] * 0.38 + x * 0.5 : x * 0.5;
    dl[i] = inL;
    dr[i] = inR;
    L[i] += x * 0.9 + dl[i] * 0.55;
    R[i] += x * 0.9 + dr[i] * 0.55;
    reverbSend[i] += x * 0.3;
  }
}

// Basit Schroeder yankısı (4 tarak + 2 tüm geçiren)
function reverb(input, combs, aps) {
  const out = new Float32Array(LEN);
  for (const [len, fb] of combs) {
    const buf = new Float32Array(len);
    let p = 0;
    let lp = 0;
    for (let i = 0; i < LEN; i++) {
      const y = buf[p];
      lp = y * 0.7 + lp * 0.3;
      buf[p] = input[i] + lp * fb;
      p = (p + 1) % len;
      out[i] += y * 0.25;
    }
  }
  for (const len of aps) {
    const buf = new Float32Array(len);
    let p = 0;
    for (let i = 0; i < LEN; i++) {
      const b = buf[p];
      const y = -out[i] * 0.5 + b;
      buf[p] = out[i] + b * 0.5;
      p = (p + 1) % len;
      out[i] = y;
    }
  }
  return out;
}
const revL = reverb(reverbSend, [[1557, 0.82], [1617, 0.82], [1491, 0.82], [1422, 0.82]], [225, 556]);
const revR = reverb(reverbSend, [[1580, 0.82], [1640, 0.82], [1514, 0.82], [1445, 0.82]], [248, 579]);
for (let i = 0; i < LEN; i++) {
  L[i] += revL[i] * 0.35;
  R[i] += revR[i] * 0.35;
}

// Mastering: yumuşak sınırlama, normalize, giriş/çıkış yumuşatma
let rawPeak = 0;
for (let i = 0; i < LEN; i++) rawPeak = Math.max(rawPeak, Math.abs(L[i]), Math.abs(R[i]));
// tepe ~1.3'e ölçeklenir; tanh yalnızca en yüksek vuruşları yumuşatır
const pre = 1.3 / rawPeak;
let peak = 0;
let sumSq = 0;
for (let i = 0; i < LEN; i++) {
  L[i] = Math.tanh(L[i] * pre);
  R[i] = Math.tanh(R[i] * pre);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  sumSq += L[i] * L[i] + R[i] * R[i];
}
const rmsDb = 20 * Math.log10(Math.sqrt(sumSq / (2 * LEN)) * (0.89 / peak));
console.log(`ham tepe ${rawPeak.toFixed(2)}, RMS ${rmsDb.toFixed(1)} dBFS`);
const norm = 0.89 / peak;
const fadeIn = idx(0.03);
const fadeOutStart = LEN - idx(PLAN.fadeOut);
const data = Buffer.alloc(LEN * 4);
for (let i = 0; i < LEN; i++) {
  let g = norm;
  if (i < fadeIn) g *= i / fadeIn;
  if (i > fadeOutStart) g *= Math.max(0, 1 - (i - fadeOutStart) / (LEN - fadeOutStart)) ** 1.5;
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), i * 4 + 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", PLAN.file);
writeFileSync(out, Buffer.concat([header, data]));
console.log(`${PLAN.file} yazıldı: ${(LEN / SR).toFixed(1)} sn, tepe ${peak.toFixed(2)} → normalize`);
