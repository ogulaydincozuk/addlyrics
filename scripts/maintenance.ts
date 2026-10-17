/**
 * Bakım görevi — günde bir kez çalıştırılması önerilir (cron / zamanlanmış görev).
 *   npm run maintenance
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { checkTrialDelays, purgeExpiredTrials } from "../src/server/domain/trials";
import { cleanupSessions, cleanupUploads } from "../src/server/maintenance";

async function main() {
  const uploads = await cleanupUploads();
  const sessions = await cleanupSessions();
  const delayed = await checkTrialDelays();
  const purged = await purgeExpiredTrials();
  console.log(`[bakım] silinen yükleme: ${uploads.removed} · süresi dolan oturum: ${sessions.sessions} · sıfırlama bağlantısı: ${sessions.resets}`);
  console.log(`[bakım] gecikme uyarısı verilen deneme: ${delayed} · saklama süresi dolup dosyaları silinen deneme: ${purged}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
