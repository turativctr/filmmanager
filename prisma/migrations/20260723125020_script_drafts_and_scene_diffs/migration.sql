-- CreateEnum
CREATE TYPE "SceneDiffTipo" AS ENUM ('ADICIONADA', 'REMOVIDA', 'MODIFICADA');

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "omitida" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "script_drafts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "corRevisao" TEXT NOT NULL,
    "numeroDraft" TEXT,
    "dataDraft" TEXT,
    "arquivoNome" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_diffs" (
    "id" TEXT NOT NULL,
    "scriptDraftId" TEXT NOT NULL,
    "sceneNumero" TEXT NOT NULL,
    "tipo" "SceneDiffTipo" NOT NULL,
    "camposAlterados" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_diffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "script_drafts_projectId_numero_key" ON "script_drafts"("projectId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "scene_diffs_scriptDraftId_sceneNumero_key" ON "scene_diffs"("scriptDraftId", "sceneNumero");

-- AddForeignKey
ALTER TABLE "script_drafts" ADD CONSTRAINT "script_drafts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_diffs" ADD CONSTRAINT "scene_diffs_scriptDraftId_fkey" FOREIGN KEY ("scriptDraftId") REFERENCES "script_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
