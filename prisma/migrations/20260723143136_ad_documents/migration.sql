-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "cacheeDiario" DECIMAL(10,2),
ADD COLUMN     "percentualHold" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "continuity_notes" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shootDayId" TEXT,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuity_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "departamento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crew_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_progress_reports" (
    "id" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "cenasConcluidas" TEXT[],
    "cenasNaoConcluidas" TEXT[],
    "paginasFilmadas" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "horaInicioReal" TEXT,
    "horaTerminoReal" TEXT,
    "atrasoMin" INTEGER,
    "motivoAtraso" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_progress_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_progress_reports_shootDayId_key" ON "daily_progress_reports"("shootDayId");

-- AddForeignKey
ALTER TABLE "continuity_notes" ADD CONSTRAINT "continuity_notes_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_notes" ADD CONSTRAINT "continuity_notes_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "shoot_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_progress_reports" ADD CONSTRAINT "daily_progress_reports_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "shoot_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
