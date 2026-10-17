import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Test veritabanına migration'ları uygular. Geliştirme veritabanına dokunmaz. */
export default function setup() {
  config({ quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL tanımlı değil (.env.example'a bakın).");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL, DATABASE_URL ile aynı olamaz: testler veriyi siler.");
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
