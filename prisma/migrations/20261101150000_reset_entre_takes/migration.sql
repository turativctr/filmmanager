-- Plano passa a ser "Takes × Duração + (Takes − 1) × Reset entre takes". O Setup sai do plano (vira
-- bloco de tempo na diária): é zerado e sai do total do plano. A coluna fica, sempre 0, só pra o
-- código que ainda estiver no ar durante o deploy não quebrar.

-- AlterTable
ALTER TABLE "shots" ADD COLUMN "resetEntreTakesMin" INTEGER NOT NULL DEFAULT 0;

-- Setup sai do total (tempoTotalMin = ceil(takes × duração) + setup, então tirar é exato).
UPDATE "shots"
SET "tempoTotalMin" = "tempoTotalMin" - "tempoSetupMin",
    "tempoSetupMin" = 0
WHERE "tempoSetupMin" > 0;
