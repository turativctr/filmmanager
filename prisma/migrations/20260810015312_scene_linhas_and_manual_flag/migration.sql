-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "oitavosDesatualizados" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "linhas" INTEGER,
ADD COLUMN     "paginasEditadoManualmente" BOOLEAN NOT NULL DEFAULT false;
