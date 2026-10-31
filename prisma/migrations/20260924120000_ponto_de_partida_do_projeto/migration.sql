-- AlterTable
ALTER TABLE "projects" DROP COLUMN "faixasTempo",
ADD COLUMN     "acrescimoExteriorPercent" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "minPorOitavoPartida" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "scenes" DROP COLUMN "classificacaoTempo";

-- DropEnum
DROP TYPE "ClassificacaoTempoCena";

