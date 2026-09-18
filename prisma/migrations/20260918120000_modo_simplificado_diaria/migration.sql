-- CreateEnum
CREATE TYPE "ModoPlanejamentoDiaria" AS ENUM ('DETALHADO', 'SIMPLIFICADO');

-- AlterTable
ALTER TABLE "shoot_days" ADD COLUMN     "horaFimAlvo" TEXT,
ADD COLUMN     "jornadaMin" INTEGER,
ADD COLUMN     "modoPlanejamento" "ModoPlanejamentoDiaria" NOT NULL DEFAULT 'DETALHADO';

