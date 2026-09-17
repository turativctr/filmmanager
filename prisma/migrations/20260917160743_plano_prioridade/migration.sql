-- CreateEnum
CREATE TYPE "ShotPrioridade" AS ENUM ('ESSENCIAL', 'DESEJAVEL', 'SE_DER_TEMPO');

-- AlterTable
ALTER TABLE "shots" ADD COLUMN     "prioridade" "ShotPrioridade" NOT NULL DEFAULT 'DESEJAVEL';
