/**
 * Veri güncellemesi: aylık teslim planı (30 / 30 / 45; ayın 1–15'i alımlarında ilk teslim 5 iş günü içinde, sonrakiler her ayın 1'i).
 * Paketlerin teslimat koşulu ve ilgili SSS cevabı güncellenir.
 *   npx tsx prisma/scripts/2026-10-delivery-plan.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { describeDeliveryPlan } from "../../src/lib/delivery-plan";
import { FAQ_SEED } from "../seed-content";

const db = new PrismaClient();

async function main() {
  const packages = await db.package.findMany({ where: { slug: { in: ["1-aylik-paket", "2-aylik-paket", "3-aylik-paket"] } } });
  for (const p of packages) {
    if (p.videoCount == null) continue;
    const terms = describeDeliveryPlan(p.videoCount, p.bonusVideoCount, p.durationMonths);
    await db.package.update({ where: { id: p.id }, data: { deliveryTerms: terms, deliveryDays: null } });
    console.log(`${p.slug}: ${terms}`);
  }
  const faq = FAQ_SEED.find((f) => f.question === "Videoları ne zaman teslim alırım?");
  if (faq) {
    const { count } = await db.faqItem.updateMany({
      where: { question: faq.question, locale: "tr" },
      data: { answer: faq.answer, needsReview: faq.needsReview },
    });
    console.log(`SSS güncellendi: ${count}`);
  }
}

main().finally(() => db.$disconnect());
