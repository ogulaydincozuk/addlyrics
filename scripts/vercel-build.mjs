/**
 * Vercel derlemesi (vercel.json → buildCommand):
 *   1. Veritabanı migration'ları — havuzsuz (doğrudan) bağlantıyla; PgBouncer üzerinden migration çalışmaz.
 *   2. Başlangıç verisi (prisma/seed.ts) — tekrar çalıştırılabilir, mevcut kayıtların üzerine yazmaz.
 *      Yönetici hesabı yalnızca SEED_ADMIN_EMAIL ve SEED_ADMIN_PASSWORD tanımlıysa oluşturulur.
 *   3. next build
 * Neon entegrasyonu DATABASE_URL (havuzlu) ve DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING (doğrudan) değişkenlerini ekler.
 */
import { execSync } from "node:child_process";

const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!direct) {
  console.error("DATABASE_URL tanımlı değil. Vercel projesine bir Postgres veritabanı (ör. Neon) bağlayın.");
  process.exit(1);
}

function run(command, extraEnv = {}) {
  console.log(`\n▶ ${command}`);
  execSync(command, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
}

run("npx prisma migrate deploy", { DATABASE_URL: direct });
run("npx tsx prisma/seed.ts", { DATABASE_URL: direct, NODE_ENV: "production" });
run("npx next build");
