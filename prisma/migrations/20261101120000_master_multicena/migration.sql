-- CreateEnum
CREATE TYPE "SceneOrigem" AS ENUM ('ROTEIRO', 'MASTER_MULTICENA');

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN "origem" "SceneOrigem" NOT NULL DEFAULT 'ROTEIRO';

-- CreateTable
CREATE TABLE "scene_coberturas" (
    "masterSceneId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,

    CONSTRAINT "scene_coberturas_pkey" PRIMARY KEY ("masterSceneId","sceneId")
);

-- CreateIndex
CREATE INDEX "scene_coberturas_sceneId_idx" ON "scene_coberturas"("sceneId");

-- AddForeignKey
ALTER TABLE "scene_coberturas" ADD CONSTRAINT "scene_coberturas_masterSceneId_fkey" FOREIGN KEY ("masterSceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_coberturas" ADD CONSTRAINT "scene_coberturas_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
