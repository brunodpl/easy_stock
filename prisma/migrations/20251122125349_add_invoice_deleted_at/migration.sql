-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "deleted_at" TIMESTAMP(6);

-- AlterTable
ALTER TABLE "warehouse_config" ALTER COLUMN "total_capacity" SET DEFAULT 1000;

-- CreateIndex
CREATE INDEX "idx_invoices_deleted" ON "invoices"("deleted_at");
