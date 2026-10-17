import "server-only";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { ffmpegPath } from "../env";

const run = promisify(execFile);

export type FfmpegCapabilities = { available: boolean; path: string | null; filters: Set<string>; error?: string };

let cached: FfmpegCapabilities | null = null;

/** ffmpeg'in kurulu olup olmadığını ve hangi filtreleri desteklediğini bir kez kontrol eder. */
export async function ffmpegCapabilities(): Promise<FfmpegCapabilities> {
  if (cached) return cached;
  const bin = ffmpegPath();
  if (!bin) return (cached = { available: false, path: null, filters: new Set(), error: "FFMPEG_PATH tanımlı değil." });
  try {
    const { stdout } = await run(bin, ["-hide_banner", "-filters"], { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 });
    const filters = new Set<string>();
    for (const line of stdout.split(/\r?\n/)) {
      const m = line.match(/^\s*[TSC.]{3}\s+(\S+)\s/);
      if (m) filters.add(m[1]!);
    }
    return (cached = { available: true, path: bin, filters });
  } catch (err) {
    return (cached = { available: false, path: bin, filters: new Set(), error: (err as Error).message.slice(0, 300) });
  }
}

/** Testlerde ve ayar değişikliğinde önbelleği temizler */
export function resetFfmpegCache() {
  cached = null;
}

/** Logo filigranı (şeffaf PNG). Depoda assets/ altında tutulur. */
export function watermarkFile() {
  const file = path.join(process.cwd(), "assets", "watermark.png");
  return existsSync(file) ? file : null;
}

export type PreviewPlan = {
  args: string[];
  watermarked: boolean;
  blurred: boolean;
};

/**
 * Ön izleme kesiti için ffmpeg argümanları: belirlenen kısa aralık, en fazla 720p, düşük bit hızı,
 * istenirse logo filigranı ve hafif bulanıklık. Filtre desteklenmiyorsa o adım atlanır ve sonuçta belirtilir.
 */
export function buildPreviewPlan(input: {
  source: string;
  output: string;
  startSeconds: number;
  durationSeconds: number;
  watermarkPath: string | null;
  watermark: boolean;
  blur: boolean;
  filters: Set<string>;
}): PreviewPlan {
  const canWatermark = Boolean(input.watermark && input.watermarkPath && input.filters.has("overlay") && input.filters.has("scale2ref"));
  const canBlur = input.blur && input.filters.has("boxblur");
  const base = `scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2${canBlur ? ",boxblur=2:1" : ""}`;

  const args = ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(input.startSeconds), "-t", String(input.durationSeconds), "-i", input.source];
  if (canWatermark) {
    args.push("-i", input.watermarkPath!);
    args.push(
      "-filter_complex",
      `[0:v]${base}[base];[1:v][base]scale2ref=w=main_w*0.34:h=ow/mdar[wm][vid];[vid][wm]overlay=x=(W-w)/2:y=H-h-H*0.07,format=yuv420p[v]`,
      "-map",
      "[v]",
      "-map",
      "0:a?",
    );
  } else {
    args.push("-vf", `${base},format=yuv420p`, "-map", "0:v:0", "-map", "0:a?");
  }
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "30",
    "-maxrate",
    "1500k",
    "-bufsize",
    "3000k",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    input.output,
  );
  return { args, watermarked: canWatermark, blurred: canBlur };
}

export function buildPosterArgs(source: string, output: string, atSeconds: number) {
  return ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(atSeconds), "-i", source, "-frames:v", "1", "-vf", "scale=-2:540", output];
}

export async function runFfmpeg(args: string[], timeoutMs = 5 * 60 * 1000) {
  const caps = await ffmpegCapabilities();
  if (!caps.available || !caps.path) throw new Error(caps.error ?? "ffmpeg kullanılamıyor.");
  try {
    await run(caps.path, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
  } catch (err) {
    const e = err as Error & { stderr?: string };
    throw new Error(`ffmpeg hatası: ${(e.stderr || e.message).toString().slice(0, 600)}`);
  }
}
