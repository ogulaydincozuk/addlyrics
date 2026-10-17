/**
 * Tek seferlik veri güncellemesi: paket fiyatları (AddLyrics tarafından belirlendi).
 *   1 Aylık: 3.200 TL · 2 Aylık: 6.200 TL · 3 Aylık: 9.400 TL
 * Fiyatlar artık gerçek olduğu için paketlerin "örnek veri" işareti kaldırılır.
 * Mevcut siparişler etkilenmez (sipariş anındaki fiyat packageSnapshot içinde saklıdır).
 *
 *   npx tsx prisma/scripts/2026-10-prices.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PRICES = [
  { slug: "1-aylik-paket", priceKurus: 320000 },
  { slug: "2-aylik-paket", priceKurus: 620000 },
  { slug: "3-aylik-paket", priceKurus: 940000 },
];

async function main() {
  for (const p of PRICES) {
    const { count } = await db.package.updateMany({ where: { slug: p.slug }, data: { priceKurus: p.priceKurus, currency: "TRY", isSample: false } });
    console.log(`${p.slug}: ${count ? `${p.priceKurus / 100} TL` : "bulunamadı"}`);
  }
}

main().finally(() => db.$disconnect());
