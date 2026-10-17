-- GERİ ALMA: 20261017150000_trial_partners_announcements
-- Ücretsiz deneme, doğrulama, iş ortaklığı/komisyon, duyuru ve denetim kayıtlarını kaldırır.
--
-- ÖNCE: veritabanı yedeği alın ve uygulamayı bu migration'dan önceki sürüme döndürün.
-- Bu betik bu tablolardaki TÜM veriyi siler (denemeler, komisyonlar, ödeme kayıtları, denetim kayıtları).
-- Deneme dosyalarına ait UploadedFile kayıtları (TRIAL_* türleri) önce silinmelidir; enum değerleri
-- (TRIAL_MASTER, TRIAL_PREVIEW, TRIAL_POSTER, PARTNER, TRIAL_UPDATE, PREVIEWS_READY, ACCOUNT) PostgreSQL'de
-- kaldırılamaz ve yerinde kalır; eski uygulama sürümü bu değerleri kullanmadığı için zararsızdır.
-- Son olarak _prisma_migrations tablosundan bu migration'ın satırı silinir.

BEGIN;

-- Deneme üretim dosyaları ve deneme kaynaklı teslimler
DELETE FROM "Deliverable" WHERE "fileId" IN (SELECT "id" FROM "UploadedFile" WHERE "kind" IN ('TRIAL_MASTER', 'TRIAL_PREVIEW', 'TRIAL_POSTER'));
DELETE FROM "UploadedFile" WHERE "kind" IN ('TRIAL_MASTER', 'TRIAL_PREVIEW', 'TRIAL_POSTER');
UPDATE "User" SET "role" = 'CUSTOMER' WHERE "role" = 'PARTNER';

-- Kısıtlar
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_discount_check";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_referralCodeId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_partnerId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_trialApplicationId_fkey";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_trialVideoId_fkey";
ALTER TABLE "UploadedFile" DROP CONSTRAINT IF EXISTS "UploadedFile_trialId_fkey";

-- Yeni tablolar (bağımlılık sırasıyla)
DROP TABLE IF EXISTS "_PackageToReferralCode";
DROP TABLE IF EXISTS "Commission";
DROP TABLE IF EXISTS "CommissionPayout";
DROP TABLE IF EXISTS "ReferralCode";
DROP TABLE IF EXISTS "Partner";
DROP TABLE IF EXISTS "TrialEvent";
DROP TABLE IF EXISTS "TrialVideo";
DROP TABLE IF EXISTS "TrialApplication";
DROP TABLE IF EXISTS "VerificationCode";
DROP TABLE IF EXISTS "PhoneAccountSlot";
DROP TABLE IF EXISTS "Announcement";
DROP TABLE IF EXISTS "AuditLog";

-- Eklenen sütunlar
ALTER TABLE "Order" DROP COLUMN IF EXISTS "discountKurus", DROP COLUMN IF EXISTS "listPriceKurus", DROP COLUMN IF EXISTS "partnerId",
  DROP COLUMN IF EXISTS "referralCodeId", DROP COLUMN IF EXISTS "trialApplicationId";
ALTER TABLE "Package" DROP COLUMN IF EXISTS "trialConversionBusinessDays", DROP COLUMN IF EXISTS "trialCountsTowardPackage";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "trialVideoId";
ALTER TABLE "UploadedFile" DROP COLUMN IF EXISTS "trialId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerifiedAt", DROP COLUMN IF EXISTS "kvkkAcceptedAt", DROP COLUMN IF EXISTS "kvkkVersion",
  DROP COLUMN IF EXISTS "phoneVerifiedAt";

-- Yeni enum türleri
DROP TYPE IF EXISTS "TrialStage";
DROP TYPE IF EXISTS "VerificationChannel";
DROP TYPE IF EXISTS "DiscountType";
DROP TYPE IF EXISTS "CommissionBase";
DROP TYPE IF EXISTS "CommissionStatus";
DROP TYPE IF EXISTS "AnnouncementDisplay";
DROP TYPE IF EXISTS "AnnouncementStatus";

-- Sistem ayarları
DELETE FROM "SiteSetting" WHERE "key" IN ('system.trial', 'system.commerce');

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261017150000_trial_partners_announcements';

COMMIT;
