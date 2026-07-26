-- CreateEnum
CREATE TYPE "ProjectStepEtapa" AS ENUM ('ROTEIRO', 'ELENCO', 'BREAKDOWN', 'CRONOGRAMA', 'ORDEM_DO_DIA', 'ORCAMENTO');

-- CreateTable
CREATE TABLE "project_step_overrides" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "etapa" "ProjectStepEtapa" NOT NULL,
    "concluidaManualmente" BOOLEAN NOT NULL DEFAULT false,
    "concluidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_step_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_step_overrides_projectId_etapa_key" ON "project_step_overrides"("projectId", "etapa");

-- AddForeignKey
ALTER TABLE "project_step_overrides" ADD CONSTRAINT "project_step_overrides_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
