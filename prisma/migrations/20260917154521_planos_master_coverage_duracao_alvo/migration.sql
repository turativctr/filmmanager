-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "duracaoAlvoMin" INTEGER;

-- AlterTable
ALTER TABLE "shots" ADD COLUMN     "ehMaster" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planoPaiId" TEXT;

-- CreateIndex
CREATE INDEX "shots_planoPaiId_idx" ON "shots"("planoPaiId");

-- AddForeignKey
ALTER TABLE "shots" ADD CONSTRAINT "shots_planoPaiId_fkey" FOREIGN KEY ("planoPaiId") REFERENCES "shots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
