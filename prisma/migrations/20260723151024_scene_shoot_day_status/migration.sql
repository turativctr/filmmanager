-- CreateEnum
CREATE TYPE "SceneShootDayStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'ADIADA');

-- AlterTable
ALTER TABLE "scene_shoot_days" ADD COLUMN     "horaFimReal" TEXT,
ADD COLUMN     "horaInicioReal" TEXT,
ADD COLUMN     "status" "SceneShootDayStatus" NOT NULL DEFAULT 'PENDENTE';
