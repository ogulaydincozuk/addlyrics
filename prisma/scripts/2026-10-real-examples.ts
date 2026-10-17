/**
 * Tek seferlik veri güncellemesi: gerçek TikTok örneklerini portfolyoya ekler ve
 * stil önizlemelerini (demo) yayından kaldırır. Tekrar çalıştırılabilir.
 *
 *   npx tsx prisma/scripts/2026-10-real-examples.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { REAL_PORTFOLIO_SEED } from "../seed-content";

const db = new PrismaClient();

async function main() {
  for (const [i, p] of REAL_PORTFOLIO_SEED.entries()) {
    const exists = await db.portfolioItem.findFirst({ where: { embedProvider: "tiktok", embedId: p.embedId } });
    if (exists) continue;
    await db.portfolioItem.create({
      data: {
        title: p.title,
        description: p.description,
        category: p.category,
        orientation: p.orientation,
        embedProvider: "tiktok",
        embedId: p.embedId,
        authorHandle: p.authorHandle,
        sourceUrl: `https://www.tiktok.com/@${p.authorHandle}/video/${p.embedId}`,
        published: true,
        sortOrder: i + 1,
      },
    });
    console.log(`+ ${p.title}`);
  }
  const { count } = await db.portfolioItem.updateMany({ where: { isDemo: true, published: true }, data: { published: false } });
  console.log(`Yayından kaldırılan stil önizlemesi: ${count}`);
}

main().finally(() => db.$disconnect());
