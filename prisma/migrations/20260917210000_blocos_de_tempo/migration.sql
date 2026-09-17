-- CreateTable
CREATE TABLE "shoot_day_blocks" (
    "id" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "duracaoMin" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "bloco" "SceneBlock" NOT NULL DEFAULT 'MANHA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shoot_day_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shoot_day_blocks_shootDayId_idx" ON "shoot_day_blocks"("shootDayId");

-- AddForeignKey
ALTER TABLE "shoot_day_blocks" ADD CONSTRAINT "shoot_day_blocks_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "shoot_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

