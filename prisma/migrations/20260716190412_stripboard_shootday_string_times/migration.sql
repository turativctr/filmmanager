/*
  Warnings:

  - You are about to drop the column `almoco` on the `shoot_days` table. All the data in the column will be lost.
  - You are about to drop the column `desproducao` on the `shoot_days` table. All the data in the column will be lost.
  - You are about to drop the column `posAlmoco` on the `shoot_days` table. All the data in the column will be lost.
  - You are about to drop the column `rodando` on the `shoot_days` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SceneBlock" AS ENUM ('MANHA', 'TARDE');

-- AlterTable
ALTER TABLE "scene_shoot_days" ADD COLUMN     "bloco" "SceneBlock" NOT NULL DEFAULT 'MANHA';

-- AlterTable
ALTER TABLE "shoot_days" DROP COLUMN "almoco",
DROP COLUMN "desproducao",
DROP COLUMN "posAlmoco",
DROP COLUMN "rodando",
ADD COLUMN     "almocoFim" TEXT,
ADD COLUMN     "almocoInicio" TEXT,
ADD COLUMN     "blocoManhaInicio" TEXT,
ADD COLUMN     "blocoTardeInicio" TEXT,
ADD COLUMN     "desprodInicio" TEXT,
ALTER COLUMN "chamadaGeral" SET DATA TYPE TEXT;
