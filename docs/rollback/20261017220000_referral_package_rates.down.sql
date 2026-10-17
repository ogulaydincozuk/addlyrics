-- GERİ ALMA: 20261017220000_referral_package_rates
-- Pakete özel komisyon oranlarını kaldırır. Kodlar yeniden yalnızca genel orana göre çalışır.
-- Geçmiş komisyon kayıtları etkilenmez (her komisyon kendi oranını ve hesap ayrıntısını saklar).
-- ÖNCE: veritabanı yedeği alın ve uygulamayı bu migration'dan önceki sürüme döndürün.

BEGIN;
DROP TABLE IF EXISTS "ReferralCodePackageRate";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261017220000_referral_package_rates';
COMMIT;
