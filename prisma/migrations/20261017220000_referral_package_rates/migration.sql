-- Referans kodlarında pakete özel komisyon oranı (yalnızca ekleme; mevcut kodlar genel oranla çalışmaya devam eder)

-- CreateTable
CREATE TABLE "ReferralCodePackageRate" (
    "id" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "commissionRateBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCodePackageRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferralCodePackageRate_packageId_idx" ON "ReferralCodePackageRate"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCodePackageRate_referralCodeId_packageId_key" ON "ReferralCodePackageRate"("referralCodeId", "packageId");

-- AddForeignKey
ALTER TABLE "ReferralCodePackageRate" ADD CONSTRAINT "ReferralCodePackageRate_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCodePackageRate" ADD CONSTRAINT "ReferralCodePackageRate_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Oran %0–%100 (baz puan 0–10000)
ALTER TABLE "ReferralCodePackageRate" ADD CONSTRAINT "ReferralCodePackageRate_rate_check" CHECK ("commissionRateBps" >= 0 AND "commissionRateBps" <= 10000);
