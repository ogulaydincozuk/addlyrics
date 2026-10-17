/**
 * Tek seferlik veri güncellemesi: paket video sayıları 30 / 60 / 90 (+15 bonus).
 * Yalnızca video sayılarını değiştirir; fiyat ve diğer koşullara dokunmaz.
 * Mevcut siparişler etkilenmez (sipariş anındaki koşullar packageSnapshot içinde saklıdır).
 *
 *   npx tsx prisma/scripts/2026-10-video-counts.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const COUNTS = [
  { slug: "1-aylik-paket", videoCount: 30, bonusVideoCount: 0 },
  { slug: "2-aylik-paket", videoCount: 60, bonusVideoCount: 0 },
  { slug: "3-aylik-paket", videoCount: 90, bonusVideoCount: 15 },
];

async function main() {
  for (const c of COUNTS) {
    const { count } = await db.package.updateMany({
      where: { slug: c.slug },
      data: { videoCount: c.videoCount, bonusVideoCount: c.bonusVideoCount },
    });
    console.log(`${c.slug}: ${count ? `${c.videoCount} + ${c.bonusVideoCount} bonus` : "bulunamadı"}`);
  }
}

main().finally(() => db.$disconnect());
