-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ATIVO', 'CONCLUIDO');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'ATIVO';
ALTER TABLE "projects" ADD COLUMN "arquivado" BOOLEAN NOT NULL DEFAULT false;
