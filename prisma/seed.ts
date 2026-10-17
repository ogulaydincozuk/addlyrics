/**
 * Başlangıç verisi. Tekrar çalıştırılabilir: mevcut kayıtların üzerine yazmaz.
 *   npm run db:seed
 *
 * Paketler AddLyrics'in belirlediği fiyat, video sayısı ve teslim planıyla yayında oluşturulur;
 * sonradan admin panelinden değiştirilebilir. Geliştirme ortamında ayrıca bir test editörü eklenir.
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { describeDeliveryPlan } from "../src/lib/delivery-plan";
import { FAQ_SEED, PAGE_SEED, PORTFOLIO_SEED, REAL_PORTFOLIO_SEED } from "./seed-content";

const db = new PrismaClient();

const isProduction = process.env.NODE_ENV === "production";

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("• SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD tanımlı değil, yönetici oluşturulmadı.");
    return;
  }
  if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD en az 10 karakter olmalı.");
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    console.log(`• Yönetici mevcut: ${email}`);
    return;
  }
  await db.user.create({
    data: {
      email,
      name: "AddLyrics Yönetici",
      role: "ADMIN",
      passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    },
  });
  console.log(`• Yönetici oluşturuldu: ${email}`);
}

async function seedPackages() {
  // Fiyat ve video sayıları AddLyrics tarafından belirlendi:
  //   1 ay: 3.200 TL / 30 video · 2 ay: 6.200 TL / 60 video · 3 ay: 9.400 TL / 90 + 15 bonus video
  // Teslim: aylık 30 video (3 aylıkta son teslim 45, bonus dahil). Paketlerde revizyon hakkı yoktur.
  // Satış, gerçek bir ödeme sağlayıcısı yapılandırıldığında açılır.
  const base = [
    { slug: "1-aylik-paket", name: "1 Aylık Paket", durationMonths: 1, sortOrder: 1, priceKurus: 320000, videoCount: 30, bonusVideoCount: 0 },
    { slug: "2-aylik-paket", name: "2 Aylık Paket", durationMonths: 2, sortOrder: 2, priceKurus: 620000, videoCount: 60, bonusVideoCount: 0 },
    {
      slug: "3-aylik-paket",
      name: "3 Aylık Paket",
      durationMonths: 3,
      sortOrder: 3,
      priceKurus: 940000,
      videoCount: 90,
      bonusVideoCount: 15,
      isFeatured: true,
    },
  ];

  for (const p of base) {
    const exists = await db.package.findUnique({ where: { slug: p.slug } });
    if (exists) continue;
    await db.package.create({
      data: {
        ...p,
        tagline: `${p.durationMonths} ay boyunca düzenli lyrics video içeriği`,
        includedFormats: ["VERTICAL", "HORIZONTAL", "SQUARE"],
        includedStyles: ["FILM_EDIT", "MINIMAL", "MUSIC_VIDEO", "CUSTOM"],
        features: ["Gerçek editörler tarafından hazırlanır", "Müşteri panelinden teslim ve indirme"],
        deliveryTerms: describeDeliveryPlan(p.videoCount, p.bonusVideoCount, p.durationMonths),
        status: "PUBLISHED" as const,
      },
    });
    console.log(`• Paket oluşturuldu: ${p.name}`);
  }
}

async function seedContent() {
  if ((await db.faqItem.count()) === 0) {
    await db.faqItem.createMany({
      data: FAQ_SEED.map((f, i) => ({ ...f, sortOrder: i + 1, locale: "tr" })),
    });
    console.log(`• ${FAQ_SEED.length} SSS kaydı oluşturuldu`);
  }
  for (const page of PAGE_SEED) {
    const exists = await db.contentPage.findUnique({ where: { slug_locale: { slug: page.slug, locale: "tr" } } });
    if (!exists) {
      await db.contentPage.create({ data: { ...page, locale: "tr" } });
      console.log(`• Sayfa oluşturuldu: ${page.title}${page.isLegal ? " (taslak hukuki metin)" : ""}`);
    }
  }
  if ((await db.portfolioItem.count()) === 0) {
    await db.portfolioItem.createMany({
      data: [
        ...REAL_PORTFOLIO_SEED.map((p, i) => ({
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
        })),
        ...PORTFOLIO_SEED.map((p, i) => ({ ...p, isDemo: true, published: false, sortOrder: 100 + i })),
      ],
    });
    console.log(`• ${REAL_PORTFOLIO_SEED.length} örnek video (TikTok) ve ${PORTFOLIO_SEED.length} stil önizlemesi oluşturuldu`);
  }
}

async function seedDevEditor() {
  if (isProduction) return;
  if ((await db.editor.count()) > 0) return;
  await db.editor.create({
    data: {
      name: "Test Editör",
      email: "editor@addlyrics.test",
      specialties: ["FILM_EDIT", "MINIMAL", "MUSIC_VIDEO"],
      notes: "Geliştirme verisi — gerçek editör kaydı değildir.",
    },
  });
  console.log("• Geliştirme için test editörü oluşturuldu");
}

async function main() {
  await seedAdmin();
  await seedPackages();
  await seedContent();
  await seedDevEditor();
}

main()
  .then(() => console.log("Seed tamamlandı."))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
