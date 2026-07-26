-- CreateTable
CREATE TABLE "shot_schedules" (
    "id" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "bloco" "SceneBlock",
    "tempoResetMin" INTEGER,
    "tipoReset" "ShotTipoReset" NOT NULL DEFAULT 'NENHUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shot_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shot_schedules_shotId_key" ON "shot_schedules"("shotId");

-- CreateIndex
CREATE UNIQUE INDEX "shot_schedules_shootDayId_ordem_key" ON "shot_schedules"("shootDayId", "ordem");

-- AddForeignKey
ALTER TABLE "shot_schedules" ADD CONSTRAINT "shot_schedules_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_schedules" ADD CONSTRAINT "shot_schedules_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "shoot_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_schedules" ADD CONSTRAINT "shot_schedules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
