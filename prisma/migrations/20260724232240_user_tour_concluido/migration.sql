-- AlterTable
ALTER TABLE "users" ADD COLUMN "tourConcluido" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: usuários que já têm pelo menos 1 projeto claramente já passaram do primeiro
-- acesso — sem isso, o tour de boas-vindas apareceria do nada pra todo mundo que já usa o
-- app, o que não é a intenção (o tour é só pra quem cria o primeiro projeto de verdade).
UPDATE "users"
SET "tourConcluido" = true
WHERE id IN (SELECT DISTINCT "ownerId" FROM "projects" WHERE "ownerId" IS NOT NULL);
