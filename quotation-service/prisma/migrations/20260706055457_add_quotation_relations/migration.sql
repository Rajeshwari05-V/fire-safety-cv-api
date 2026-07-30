-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "quotationId" INTEGER;

-- AlterTable
ALTER TABLE "UploadedPlan" ADD COLUMN     "quotationId" INTEGER;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedPlan" ADD CONSTRAINT "UploadedPlan_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
