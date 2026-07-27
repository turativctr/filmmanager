-- Locação como entidade própria, separada de Scene.locacao (texto livre). Passos, nesta ordem
-- (tudo dentro da mesma transação de migração, já garantida pelo Prisma por arquivo):
--   1. Criar as tabelas locacoes e pontos_apoio
--   2. Adicionar Scene.locacaoId
--   3. Para cada projeto, criar uma Locacao por valor distinto e não-nulo de Scene.locacao
--      (comparação sem diferenciar maiúscula/minúscula), usando como nome a primeira grafia
--      encontrada
--   4. Preencher Scene.locacaoId apontando para a Locacao correspondente
--   5. Só então remover a coluna Scene.locacao
-- Nenhum dado é perdido: todo valor de locacao vira uma Locacao real antes da coluna ser removida.

-- 1. CreateEnum
CREATE TYPE "TipoPontoApoio" AS ENUM ('METRO_TREM', 'ONIBUS', 'ESTACIONAMENTO', 'MERCADO', 'FARMACIA', 'RESTAURANTE', 'POSTO_COMBUSTIVEL', 'OUTRO');

-- 1. CreateTable
CREATE TABLE "locacoes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "contatoNome" TEXT,
    "contatoTelefone" TEXT,
    "notas" TEXT,
    "hospitalNome" TEXT,
    "hospitalEndereco" TEXT,
    "hospitalTelefone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locacoes_pkey" PRIMARY KEY ("id")
);

-- 1. CreateTable
CREATE TABLE "pontos_apoio" (
    "id" TEXT NOT NULL,
    "locacaoId" TEXT NOT NULL,
    "tipo" "TipoPontoApoio" NOT NULL,
    "descricao" TEXT NOT NULL,
    "endereco" TEXT,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "pontos_apoio_pkey" PRIMARY KEY ("id")
);

-- 1. AddForeignKey
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 1. AddForeignKey
ALTER TABLE "pontos_apoio" ADD CONSTRAINT "pontos_apoio_locacaoId_fkey" FOREIGN KEY ("locacaoId") REFERENCES "locacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. AlterTable
ALTER TABLE "scenes" ADD COLUMN "locacaoId" TEXT;

-- 2. AddForeignKey (nullable + ainda não populada nesta altura, então segura de adicionar já)
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_locacaoId_fkey" FOREIGN KEY ("locacaoId") REFERENCES "locacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Normaliza pra comparação sem diferenciar maiúscula/minúscula. O banco usa collation "C" (byte a
-- byte), então o LOWER() nativo do Postgres NÃO dobra letras acentuadas (ex.: "KARAOKÊ" via LOWER()
-- vira "karaokÊ", não "karaokê" — o Ê maiúsculo fica intocado) — sem tratar isso, "Karaokê" e
-- "KARAOKÊ" virariam duas Locacao diferentes por engano. TRANSLATE troca as acentuadas comuns do
-- português (maiúsculas e minúsculas) pelas equivalentes sem acento antes do LOWER() final, o que
-- resolve o problema sem depender da extensão unaccent (não instalada neste banco).
-- 3. Backfill: uma Locacao por valor distinto e não-nulo de Scene.locacao por projeto, sem
-- diferenciar maiúscula/minúscula — nome = a grafia da cena mais antiga (createdAt, depois id como
-- desempate) daquele grupo, exatamente como veio, sem trim.
WITH first_spelling AS (
  SELECT DISTINCT ON (
    "projectId",
    LOWER(TRANSLATE(TRIM(locacao), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'))
  )
    "projectId",
    locacao AS nome
  FROM "scenes"
  WHERE locacao IS NOT NULL AND TRIM(locacao) <> ''
  ORDER BY
    "projectId",
    LOWER(TRANSLATE(TRIM(locacao), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
    "createdAt" ASC,
    "id" ASC
)
INSERT INTO "locacoes" ("id", "projectId", "nome", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "projectId", "nome", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM first_spelling;

-- 4. Aponta Scene.locacaoId pra Locacao correspondente (mesmo projeto, mesma grafia sem diferenciar
-- maiúscula/minúscula, comparando os dois lados já aparados de espaços e com acentos normalizados).
UPDATE "scenes" s
SET "locacaoId" = l."id"
FROM "locacoes" l
WHERE l."projectId" = s."projectId"
  AND s."locacao" IS NOT NULL AND TRIM(s."locacao") <> ''
  AND LOWER(TRANSLATE(TRIM(l."nome"), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'))
    = LOWER(TRANSLATE(TRIM(s."locacao"), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'));

-- 5. Só agora remove a coluna antiga, com todo dado já preservado em Locacao.
ALTER TABLE "scenes" DROP COLUMN "locacao";
