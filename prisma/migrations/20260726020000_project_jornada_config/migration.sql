-- AlterTable
ALTER TABLE "projects" ADD COLUMN "limiteAlmocoMin" INTEGER NOT NULL DEFAULT 360;
ALTER TABLE "projects" ADD COLUMN "duracaoAlmocoMin" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "projects" ADD COLUMN "preparacaoInicialMin" INTEGER NOT NULL DEFAULT 60;

-- Backfill preparacaoInicialMin de cada projeto a partir da diária de menor numeroDia que já tem
-- chamadaGeral e blocoManhaInicio preenchidos — assim a primeira execução de recalculateDayBlocks()
-- reproduz o horário que já está montado, em vez de deslocar silenciosamente um cronograma existente.
WITH candidate AS (
  SELECT DISTINCT ON ("projectId")
    "projectId",
    (
      (split_part("blocoManhaInicio", ':', 1)::int * 60 + split_part("blocoManhaInicio", ':', 2)::int)
      - (split_part("chamadaGeral", ':', 1)::int * 60 + split_part("chamadaGeral", ':', 2)::int)
    ) AS diff_min
  FROM "shoot_days"
  WHERE "chamadaGeral" IS NOT NULL AND "blocoManhaInicio" IS NOT NULL
  ORDER BY "projectId", "numeroDia" ASC
)
UPDATE "projects" p
SET "preparacaoInicialMin" = candidate.diff_min
FROM candidate
WHERE candidate."projectId" = p.id
  AND candidate.diff_min > 0;
