-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('ORDER_CREATED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'STATUS_CHANGED', 'DELIVERY', 'ADMIN_NOTE', 'FILES_NEEDED', 'ADMIN_ALERT');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PAYMENT_PENDING', 'NEW', 'AWAITING_FILES', 'ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "OrderEvent" ALTER COLUMN "fromStatus" TYPE "OrderStatus_new" USING ("fromStatus"::text::"OrderStatus_new");
ALTER TABLE "OrderEvent" ALTER COLUMN "toStatus" TYPE "OrderStatus_new" USING ("toStatus"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Revision" DROP CONSTRAINT "Revision_deliverableId_fkey";

-- DropForeignKey
ALTER TABLE "Revision" DROP CONSTRAINT "Revision_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Revision" DROP CONSTRAINT "Revision_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Revision" DROP CONSTRAINT "Revision_requestedById_fkey";

-- AlterTable
ALTER TABLE "Package" DROP COLUMN "revisionTerms",
DROP COLUMN "revisionsPerVideo";

-- AlterTable
ALTER TABLE "PackageEntitlement" DROP COLUMN "revisionsPerVideo";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "revisionsAllowed";

-- DropTable
DROP TABLE "Revision";

-- DropEnum
DROP TYPE "RevisionStatus";

