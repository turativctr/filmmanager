-- CreateEnum
CREATE TYPE "ShotTipoReset" AS ENUM ('NENHUM', 'AJUSTE', 'TROCA_LENTE', 'TROCA_CAMERA', 'RESET_POSICAO', 'RESET_COMPLETO');

-- CreateEnum
CREATE TYPE "ShotStatus" AS ENUM ('PENDENTE', 'FILMADO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "shots" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tamanho" TEXT,
    "lente" TEXT,
    "angulo" TEXT,
    "movimento" TEXT,
    "tempoEstimadoMin" INTEGER,
    "tempoResetMin" INTEGER,
    "tipoReset" "ShotTipoReset" NOT NULL DEFAULT 'NENHUM',
    "notasDirecao" TEXT,
    "notasContinuidade" TEXT,
    "status" "ShotStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shots_sceneId_ordem_key" ON "shots"("sceneId", "ordem");

-- AddForeignKey
ALTER TABLE "shots" ADD CONSTRAINT "shots_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shots" ADD CONSTRAINT "shots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
