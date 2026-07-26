-- AlterTable
ALTER TABLE "scenes" ADD COLUMN "sinopseAD" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "continuismoResponsavel" TEXT NOT NULL DEFAULT 'Continuidade';
ALTER TABLE "projects" ADD COLUMN "continuismoUsarLogo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "projects" ADD COLUMN "continuismoLinhasPorFolha" INTEGER NOT NULL DEFAULT 12;
