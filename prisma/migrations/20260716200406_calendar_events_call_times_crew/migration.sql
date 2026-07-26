-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('ENSAIO', 'VIAGEM', 'FIGURINO', 'FERIADO', 'FOLGA', 'OUTRO');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "equipeTecnica" INTEGER;

-- CreateTable
CREATE TABLE "character_call_times" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "chamada" TEXT,
    "saida" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_call_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" "CalendarEventType" NOT NULL,
    "nome" TEXT NOT NULL,
    "elementosAfetados" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "character_call_times_characterId_shootDayId_key" ON "character_call_times"("characterId", "shootDayId");

-- AddForeignKey
ALTER TABLE "character_call_times" ADD CONSTRAINT "character_call_times_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_call_times" ADD CONSTRAINT "character_call_times_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "shoot_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
