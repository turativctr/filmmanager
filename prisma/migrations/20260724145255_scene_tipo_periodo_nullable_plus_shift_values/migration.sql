-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SceneShift" ADD VALUE 'AMANHECER';
ALTER TYPE "SceneShift" ADD VALUE 'CONTINUO';
ALTER TYPE "SceneShift" ADD VALUE 'DEPOIS';

-- AlterTable
ALTER TABLE "scenes" ALTER COLUMN "tipo" DROP NOT NULL,
ALTER COLUMN "periodo" DROP NOT NULL;
