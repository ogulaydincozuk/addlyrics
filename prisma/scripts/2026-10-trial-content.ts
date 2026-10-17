/**
 * Veri güncellemesi: ücretsiz deneme koşulları sayfasını ekler ve KVKK taslağını (telefon doğrulaması,
 * deneme, referans kodu ve saklama süreleri) günceller. KVKK sayfasında admin düzenlemelerinin üzerine yazar.
 *   npx tsx prisma/scripts/2026-10-trial-content.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PAGE_SEED } from "../seed-content";

const db = new PrismaClient();

async function main() {
  for (const slug of ["ucretsiz-deneme-kosullari", "kvkk-aydinlatma-metni"]) {
    const page = PAGE_SEED.find((p) => p.slug === slug);
    if (!page) continue;
    await db.contentPage.upsert({
      where: { slug_locale: { slug, locale: "tr" } },
      create: { ...page, locale: "tr" },
      update: { body: page.body, title: page.title, metaDescription: page.metaDescription },
    });
    console.log(`Sayfa güncellendi: ${slug}`);
  }
}

main().finally(() => db.$disconnect());
