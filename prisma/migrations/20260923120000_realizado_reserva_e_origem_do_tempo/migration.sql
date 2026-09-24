-- CreateEnum
CREATE TYPE "ClassificacaoTempoCena" AS ENUM ('NAO_CLASSIFICADO', 'DIALOGO_ESTATICO', 'COM_MOVIMENTO', 'EFEITO_VFX', 'EXTERIOR');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "faixasTempo" JSONB;

-- AlterTable
ALTER TABLE "scene_shoot_days" ADD COLUMN     "rodDigitado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "classificacaoTempo" "ClassificacaoTempoCena" NOT NULL DEFAULT 'NAO_CLASSIFICADO';

-- AlterTable
ALTER TABLE "shoot_day_blocks" ADD COLUMN     "horaFimReal" TEXT,
ADD COLUMN     "horaInicioReal" TEXT;

-- AlterTable
ALTER TABLE "shoot_days" ADD COLUMN     "reservaMin" INTEGER;

