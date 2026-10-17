-- CreateEnum
CREATE TYPE "TrialStage" AS ENUM ('RECEIVED', 'FILES_CHECK', 'NEEDS_INFO', 'QUEUED', 'IN_PRODUCTION', 'EDITOR_REVIEW', 'PREVIEW_READY', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionBase" AS ENUM ('LIST_PRICE', 'PAID_AMOUNT', 'PAID_AMOUNT_EXCL_VAT');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnnouncementDisplay" AS ENUM ('MODAL', 'BANNER', 'TOAST');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'TRIAL_MASTER';
ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'TRIAL_PREVIEW';
ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'TRIAL_POSTER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRIAL_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PREVIEWS_READY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACCOUNT';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PARTNER';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountKurus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "listPriceKurus" INTEGER,
ADD COLUMN     "partnerId" TEXT,
ADD COLUMN     "referralCodeId" TEXT,
ADD COLUMN     "trialApplicationId" TEXT;

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "trialConversionBusinessDays" INTEGER,
ADD COLUMN     "trialCountsTowardPackage" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "trialVideoId" TEXT;

-- AlterTable
ALTER TABLE "UploadedFile" ADD COLUMN     "trialId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "kvkkAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "kvkkVersion" TEXT,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PhoneAccountSlot" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneAccountSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "VerificationChannel" NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialApplication" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TrialStage" NOT NULL DEFAULT 'RECEIVED',
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "formats" "VideoFormat"[],
    "footageSource" "FootageSource",
    "notesForEditor" TEXT,
    "termsVersion" TEXT NOT NULL,
    "rightsConfirmedAt" TIMESTAMP(3) NOT NULL,
    "materialsMatchConfirmedAt" TIMESTAMP(3) NOT NULL,
    "checkReport" JSONB,
    "needsInfoMessage" TEXT,
    "filesVerifiedAt" TIMESTAMP(3),
    "filesVerifiedById" TEXT,
    "previewDueAt" TIMESTAMP(3),
    "previewsReadyAt" TIMESTAMP(3),
    "delayNotifiedAt" TIMESTAMP(3),
    "decideLaterAt" TIMESTAMP(3),
    "convertedOrderId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialVideo" (
    "id" TEXT NOT NULL,
    "trialId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "style" "VideoStyle" NOT NULL,
    "approach" TEXT NOT NULL,
    "status" "TrialStage" NOT NULL DEFAULT 'QUEUED',
    "editorId" TEXT,
    "masterFileId" TEXT,
    "previewFileId" TEXT,
    "posterFileId" TEXT,
    "previewStartSec" INTEGER NOT NULL DEFAULT 0,
    "previewSeconds" INTEGER,
    "watermarked" BOOLEAN NOT NULL DEFAULT false,
    "blurred" BOOLEAN NOT NULL DEFAULT false,
    "previewSource" TEXT,
    "processingError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "previewReadyAt" TIMESTAMP(3),
    "qcApprovedAt" TIMESTAMP(3),
    "qcById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialEvent" (
    "id" TEXT NOT NULL,
    "trialId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "visibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "socialAccounts" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "commissionRateBps" INTEGER NOT NULL,
    "commissionBase" "CommissionBase" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "baseType" "CommissionBase" NOT NULL,
    "baseAmountKurus" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amountKurus" INTEGER NOT NULL,
    "calculation" JSONB NOT NULL,
    "eligibleAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "payoutId" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "clawbackAt" TIMESTAMP(3),
    "clawbackPayoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPayout" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amountKurus" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkLabel" TEXT,
    "linkUrl" TEXT,
    "display" "AnnouncementDisplay" NOT NULL DEFAULT 'BANNER',
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT,
    "data" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PackageToReferralCode" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PackageToReferralCode_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneAccountSlot_userId_key" ON "PhoneAccountSlot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneAccountSlot_phone_slot_key" ON "PhoneAccountSlot"("phone", "slot");

-- CreateIndex
CREATE INDEX "VerificationCode_userId_channel_createdAt_idx" ON "VerificationCode"("userId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationCode_target_createdAt_idx" ON "VerificationCode"("target", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationCode_codeHash_idx" ON "VerificationCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "TrialApplication_number_key" ON "TrialApplication"("number");

-- CreateIndex
CREATE UNIQUE INDEX "TrialApplication_userId_key" ON "TrialApplication"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialApplication_songId_key" ON "TrialApplication"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialApplication_convertedOrderId_key" ON "TrialApplication"("convertedOrderId");

-- CreateIndex
CREATE INDEX "TrialApplication_status_idx" ON "TrialApplication"("status");

-- CreateIndex
CREATE INDEX "TrialApplication_previewDueAt_idx" ON "TrialApplication"("previewDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrialVideo_masterFileId_key" ON "TrialVideo"("masterFileId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialVideo_previewFileId_key" ON "TrialVideo"("previewFileId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialVideo_posterFileId_key" ON "TrialVideo"("posterFileId");

-- CreateIndex
CREATE INDEX "TrialVideo_status_idx" ON "TrialVideo"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrialVideo_trialId_sequence_key" ON "TrialVideo"("trialId", "sequence");

-- CreateIndex
CREATE INDEX "TrialEvent_trialId_createdAt_idx" ON "TrialEvent"("trialId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_partnerId_idx" ON "ReferralCode"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_orderId_key" ON "Commission"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_paymentId_key" ON "Commission"("paymentId");

-- CreateIndex
CREATE INDEX "Commission_partnerId_status_idx" ON "Commission"("partnerId", "status");

-- CreateIndex
CREATE INDEX "Commission_status_idx" ON "Commission"("status");

-- CreateIndex
CREATE INDEX "CommissionPayout_partnerId_paidAt_idx" ON "CommissionPayout"("partnerId", "paidAt");

-- CreateIndex
CREATE INDEX "Announcement_status_startsAt_endsAt_idx" ON "Announcement"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "_PackageToReferralCode_B_index" ON "_PackageToReferralCode"("B");

-- CreateIndex
CREATE INDEX "Order_partnerId_idx" ON "Order"("partnerId");

-- CreateIndex
CREATE INDEX "Order_trialApplicationId_idx" ON "Order"("trialApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_trialVideoId_key" ON "Project"("trialVideoId");

-- CreateIndex
CREATE INDEX "UploadedFile_trialId_idx" ON "UploadedFile"("trialId");

-- AddForeignKey
ALTER TABLE "PhoneAccountSlot" ADD CONSTRAINT "PhoneAccountSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_trialApplicationId_fkey" FOREIGN KEY ("trialApplicationId") REFERENCES "TrialApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_trialVideoId_fkey" FOREIGN KEY ("trialVideoId") REFERENCES "TrialVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "TrialApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialApplication" ADD CONSTRAINT "TrialApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialApplication" ADD CONSTRAINT "TrialApplication_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialApplication" ADD CONSTRAINT "TrialApplication_filesVerifiedById_fkey" FOREIGN KEY ("filesVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialApplication" ADD CONSTRAINT "TrialApplication_convertedOrderId_fkey" FOREIGN KEY ("convertedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialVideo" ADD CONSTRAINT "TrialVideo_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "TrialApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialVideo" ADD CONSTRAINT "TrialVideo_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "Editor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialVideo" ADD CONSTRAINT "TrialVideo_masterFileId_fkey" FOREIGN KEY ("masterFileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialVideo" ADD CONSTRAINT "TrialVideo_previewFileId_fkey" FOREIGN KEY ("previewFileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialVideo" ADD CONSTRAINT "TrialVideo_posterFileId_fkey" FOREIGN KEY ("posterFileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialVideo" ADD CONSTRAINT "TrialVideo_qcById_fkey" FOREIGN KEY ("qcById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialEvent" ADD CONSTRAINT "TrialEvent_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "TrialApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialEvent" ADD CONSTRAINT "TrialEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "CommissionPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PackageToReferralCode" ADD CONSTRAINT "_PackageToReferralCode_A_fkey" FOREIGN KEY ("A") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PackageToReferralCode" ADD CONSTRAINT "_PackageToReferralCode_B_fkey" FOREIGN KEY ("B") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Telefon başına en fazla 2 doğrulanmış hesap: slot yalnızca 1 veya 2 olabilir
ALTER TABLE "PhoneAccountSlot" ADD CONSTRAINT "PhoneAccountSlot_slot_check" CHECK ("slot" IN (1, 2));
-- Komisyon ve indirim değerleri negatif olamaz
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_values_check" CHECK ("discountValue" >= 0 AND "commissionRateBps" >= 0 AND "commissionRateBps" <= 10000 AND ("usageLimit" IS NULL OR "usageLimit" > 0));
ALTER TABLE "Order" ADD CONSTRAINT "Order_discount_check" CHECK ("discountKurus" >= 0 AND "priceKurus" >= 0);
