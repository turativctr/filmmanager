-- AlterTable
ALTER TABLE "shots" ADD COLUMN "takesPrevistos" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "shots" ADD COLUMN "duracaoTakeMin" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "shots" ADD COLUMN "tempoSetupMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "shots" ADD COLUMN "tempoTotalMin" INTEGER NOT NULL DEFAULT 6;

-- Migração de dados: duracaoTakeMin = tempoEstimadoMin / 3 (arredondado, mínimo 1), takesPrevistos = 3,
-- tempoSetupMin = 0, depois tempoTotalMin recalculado a partir dos três.
UPDATE "shots" SET
  "duracaoTakeMin" = GREATEST(1, ROUND(COALESCE("tempoEstimadoMin", 6)::numeric / 3)::int),
  "takesPrevistos" = 3,
  "tempoSetupMin" = 0;

UPDATE "shots" SET "tempoTotalMin" = ("takesPrevistos" * "duracaoTakeMin") + "tempoSetupMin";

-- DropColumn
ALTER TABLE "shots" DROP COLUMN "tempoEstimadoMin";
