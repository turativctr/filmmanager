-- AlterTable
ALTER TABLE "breakdown_sheets" ADD COLUMN     "notasProducao" TEXT;

-- AlterTable
ALTER TABLE "scenes" ALTER COLUMN "paginas" SET DATA TYPE DECIMAL(6,3);
