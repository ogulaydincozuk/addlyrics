/**
 * Bir içerik sayfasını seed içeriğiyle günceller (yalnızca geliştirme; admin düzenlemelerinin
 * üzerine yazar!).   npx tsx prisma/scripts/sync-page.ts <slug>
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PAGE_SEED } from "../seed-content";

const db = new PrismaClient();
const slug = process.argv[2];
const page = PAGE_SEED.find((p) => p.slug === slug);
if (!page) throw new Error(`Bilinmeyen sayfa: ${slug}`);
if (process.env.NODE_ENV === "production") throw new Error("Üretimde çalıştırılamaz.");
db.contentPage
  .update({ where: { slug_locale: { slug: page.slug, locale: "tr" } }, data: { body: page.body } })
  .then(() => console.log(`${slug} güncellendi`))
  .finally(() => db.$disconnect());
