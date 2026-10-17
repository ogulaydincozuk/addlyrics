import os from "node:os";
import path from "node:path";
import { config } from "dotenv";

config({ quiet: true });

// Testler her zaman ayrı veritabanında ve geçici depolama dizininde çalışır
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PAYMENT_PROVIDER = "mock";
process.env.ALLOW_TEST_PAYMENTS = "true";
process.env.ALLOW_SAMPLE_PACKAGES = "true";
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_LOCAL_DIR = path.join(os.tmpdir(), "addlyrics-test-storage");
process.env.EMAIL_DRIVER = "console";
// SMS: konsol sağlayıcısı (test ortamında kodlar sentSms dizisinde biriktirilir); ffmpeg kapalı
process.env.SMS_PROVIDER = "console";
delete process.env.FFMPEG_PATH;
process.env.APP_URL = "http://localhost:3000";
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
