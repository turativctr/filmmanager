-- Tempos de reset configuráveis, em 3 níveis:
--
-- Nível 1 (padrão do projeto): defaults idênticos aos valores que hoje estão fixos em
-- RESET_MINUTES (src/lib/shots-shared.ts) — NENHUM=0 (sem coluna), AJUSTE=3, TROCA_LENTE=8,
-- TROCA_CAMERA=10, RESET_POSICAO=15, RESET_COMPLETO=20. Nenhum tempoResetMin já persistido muda
-- de valor, por isso não precisa de backfill.
ALTER TABLE "projects" ADD COLUMN "resetAjusteMin" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "projects" ADD COLUMN "resetTrocaLenteMin" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "projects" ADD COLUMN "resetTrocaCameraMin" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "projects" ADD COLUMN "resetPosicaoMin" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "projects" ADD COLUMN "resetCompletoMin" INTEGER NOT NULL DEFAULT 20;

-- Nível 2 (ajuste por plano): nulo = segue o padrão do projeto pro tipo classificado.
ALTER TABLE "shots" ADD COLUMN "tempoResetMinManual" INTEGER;
ALTER TABLE "shot_schedules" ADD COLUMN "tempoResetMinManual" INTEGER;

-- Nível 3 (fator do dia): 100 = sem ajuste. Só aplicado em tempo de leitura, nunca gravado em
-- Shot/ShotSchedule nem usado no cálculo de Rod/blocoManha/almoço.
ALTER TABLE "shoot_days" ADD COLUMN "fatorResetPercent" INTEGER NOT NULL DEFAULT 100;
