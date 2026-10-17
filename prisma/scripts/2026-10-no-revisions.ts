/**
 * Veri güncellemesi: paketlerde revizyon hakkı kaldırıldı.
 * İlgili SSS cevaplarını ve revizyondan bahseden yasal taslakları günceller.
 * Uyarı: yasal sayfaların gövdesini seed içeriğiyle değiştirir (admin düzenlemelerinin üzerine yazar).
 *   npx tsx prisma/scripts/2026-10-no-revisions.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { FAQ_SEED, PAGE_SEED } from "../seed-content";

const db = new PrismaClient();
const FAQ_QUESTIONS = ["Revizyon hakkım var mı?", "Paketimi satın aldıktan sonra ne yapmam gerekiyor?"];
const PAGES = ["kullanim-kosullari", "mesafeli-satis-sozlesmesi", "on-bilgilendirme-formu"];

async function main() {
  for (const q of FAQ_QUESTIONS) {
    const faq = FAQ_SEED.find((f) => f.question === q);
    if (!faq) continue;
    const { count } = await db.faqItem.updateMany({ where: { question: q, locale: "tr" }, data: { answer: faq.answer, needsReview: faq.needsReview } });
    console.log(`SSS "${q}": ${count}`);
  }
  for (const slug of PAGES) {
    const page = PAGE_SEED.find((p) => p.slug === slug);
    if (!page) continue;
    const { count } = await db.contentPage.updateMany({ where: { slug, locale: "tr" }, data: { body: page.body } });
    console.log(`Sayfa ${slug}: ${count}`);
  }
}

main().finally(() => db.$disconnect());
