-- CreateEnum
CREATE TYPE "ShootDayChecklistTipo" AS ENUM ('LOCACAO', 'TRANSPORTE', 'ELENCO', 'ARTE', 'SOM', 'FIGURINO', 'MAKE', 'PLAYBACK', 'OUTRO');

-- CreateTable
CREATE TABLE "shoot_day_checklists" (
    "id" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "confirmado" BOOLEAN NOT NULL DEFAULT false,
    "tipo" "ShootDayChecklistTipo" NOT NULL,
    "geradoAutomaticamente" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shoot_day_checklists_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shoot_day_checklists" ADD CONSTRAINT "shoot_day_checklists_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "shoot_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
