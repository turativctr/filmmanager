-- AlterTable
ALTER TABLE "scene_shoot_days" ADD COLUMN     "scenePartId" TEXT;

-- AlterTable
ALTER TABLE "shots" ADD COLUMN     "scenePartId" TEXT;

-- CreateTable
CREATE TABLE "scene_parts" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "oitavos" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scene_parts_sceneId_idx" ON "scene_parts"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "scene_shoot_days_scenePartId_key" ON "scene_shoot_days"("scenePartId");

-- CreateIndex
CREATE INDEX "shots_scenePartId_idx" ON "shots"("scenePartId");

-- AddForeignKey
ALTER TABLE "scene_parts" ADD CONSTRAINT "scene_parts_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shots" ADD CONSTRAINT "shots_scenePartId_fkey" FOREIGN KEY ("scenePartId") REFERENCES "scene_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_shoot_days" ADD CONSTRAINT "scene_shoot_days_scenePartId_fkey" FOREIGN KEY ("scenePartId") REFERENCES "scene_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

