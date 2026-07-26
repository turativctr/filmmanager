-- AlterTable
ALTER TABLE "scene_shoot_days" ADD COLUMN "observacoes" TEXT;
ALTER TABLE "scene_shoot_days" ADD COLUMN "observacoesAutoGeradas" BOOLEAN NOT NULL DEFAULT false;
