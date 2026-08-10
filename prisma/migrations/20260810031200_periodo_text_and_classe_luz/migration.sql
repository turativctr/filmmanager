-- Scene.periodo deixa de ser o enum fechado "SceneShift" e vira texto livre — um enum fechado
-- quebra a cada variação de período que um roteiro brasileiro usa (MADRUGADA, ENTARDECER,
-- CREPÚSCULO, "X PARA Y" etc.). O que fica FECHADO é o novo campo Scene.classeLuz (DIA/NOITE/
-- TRANSICAO/INDEFINIDO), derivado de periodo — é o que stripboard/escaleta/ordem de diária
-- consultam. Ver deriveClasseLuz em src/lib/fdx-parser.ts.
--
-- ATENÇÃO: escrita à mão, NÃO gerada por `prisma migrate dev` — o diff automático do Prisma pra
-- uma mudança de enum->String faz DROP COLUMN + ADD COLUMN (confirmado via `prisma migrate diff`
-- antes de escrever este arquivo), o que apaga todo o período já importado em TODOS os projetos
-- existentes, inclusive "Antes do Meu Nome nos Créditos". Usamos ALTER COLUMN ... TYPE ... USING
-- no lugar, que converte o valor em vez de descartar a coluna.
--
-- Pré-checagens rodadas antes de escrever este arquivo (não fazem parte da migração, só
-- confirmam as premissas abaixo):
--   SELECT unnest(enum_range(NULL::"SceneShift"));
--     -> DIA, NOITE, ENTARDECER, AMANHECER, CONTINUO, DEPOIS, NOITE_PARA_DIA, DIA_PARA_NOITE
--        (exatamente os 8 valores que este arquivo sabe classificar)
--   SELECT table_name, column_name FROM information_schema.columns WHERE udt_name = 'SceneShift';
--     -> só scenes.periodo — seguro derrubar o tipo no fim deste arquivo
--
-- Atomicidade: Prisma Migrate envia o arquivo inteiro como uma única mensagem multi-statement ao
-- driver Postgres, que (protocolo "simple query") executa automaticamente tudo dentro de uma
-- transação implícita — é por isso que uma falha no meio de uma migração já reverte o arquivo
-- inteiro por padrão. BEGIN/COMMIT explícitos NÃO são adicionados aqui de propósito: um BEGIN
-- dentro dessa transação implícita só gera um aviso e é ignorado, mas o COMMIT explícito
-- encerraria a transação implícita ANTES do fim do arquivo — os comandos depois dele passariam a
-- rodar em autocommit, fora da garantia atômica que se está tentando reforçar. Nada neste arquivo
-- (CREATE TYPE, ALTER TABLE, UPDATE, DROP TYPE) está na lista de comandos que o Postgres proíbe
-- dentro de transação (essa lista é essencialmente só CREATE INDEX CONCURRENTLY e ALTER TYPE ...
-- ADD VALUE em versões antigas do Postgres — nenhum dos dois aparece aqui).

-- AlterTable: converte a coluna de enum pra texto SEM apagar dado (o cast ::TEXT preserva o
-- nome do valor do enum tal qual).
ALTER TABLE "scenes" ALTER COLUMN "periodo" TYPE TEXT USING "periodo"::TEXT;

-- Normalização GENÉRICA, antes de qualquer classificação: o enum antigo usava underscore como
-- separador em valor composto (NOITE_PARA_DIA, DIA_PARA_NOITE) só por ser identificador de enum;
-- o novo formato de texto livre usa espaço ("X PARA Y", igual ao que o roteiro escreve e ao que
-- TRANSICAO_PATTERN em fdx-parser.ts reconhece). Troca TODO underscore por espaço — não só nos
-- dois valores conhecidos — pra nenhum valor composto que esta migração não previu sumir do radar
-- escondido atrás de um underscore.
UPDATE "scenes" SET "periodo" = REPLACE("periodo", '_', ' ');

-- CreateEnum
CREATE TYPE "ClasseLuz" AS ENUM ('DIA', 'NOITE', 'TRANSICAO', 'INDEFINIDO');

-- AlterTable: novas colunas — periodoFim só relevante pra classeLuz=TRANSICAO; classeLuz nasce
-- INDEFINIDO por padrão (backfill abaixo resolve o que dá pra derivar sem herança; o passe de
-- herança completo — CONTÍNUO/período não reconhecido herdando da cena anterior NA ORDEM DO
-- ROTEIRO — roda à parte, ver scripts/backfill-classe-luz.ts, que reusa a mesma lógica de
-- src/lib/fdx-parser.ts em vez de duplicá-la em SQL).
ALTER TABLE "scenes" ADD COLUMN "periodoFim" TEXT;
ALTER TABLE "scenes" ADD COLUMN "classeLuz" "ClasseLuz" NOT NULL DEFAULT 'INDEFINIDO';

-- Backfill classeLuz/periodoFim pras cenas já existentes — SEM herança (só classificação direta
-- da palavra, espelhando deriveClasseLuz). Cenas que dependem de herança (CONTÍNUO, período não
-- reconhecido) ficam INDEFINIDO aqui mesmo, resolvidas depois por scripts/backfill-classe-luz.ts.
UPDATE "scenes" SET "classeLuz" = 'DIA'
  WHERE UPPER(TRIM("periodo")) IN ('DIA', 'MANHA', 'MANHÃ', 'TARDE', 'DAY', 'MORNING', 'AFTERNOON');
UPDATE "scenes" SET "classeLuz" = 'NOITE'
  WHERE UPPER(TRIM("periodo")) IN (
    'NOITE', 'MADRUGADA', 'NIGHT', 'DAWN', 'AMANHECER', 'ALVORADA', 'DUSK', 'ENTARDECER',
    'CREPUSCULO', 'CREPÚSCULO', 'POR DO SOL', 'PÔR DO SOL', 'ANOITECER', 'MAGIC HOUR'
  );
-- TRANSICAO genérico — qualquer "X PARA Y" (não só os dois valores do enum antigo), mesma regra
-- de TRANSICAO_PATTERN/deriveClasseLuz em fdx-parser.ts. periodoFim = tudo depois do PRIMEIRO
-- " PARA " (regex não-guloso, espelhando o "(.+?)\s+PARA\s+(.+)" do TypeScript).
UPDATE "scenes" SET
    "classeLuz" = 'TRANSICAO',
    "periodoFim" = UPPER(TRIM(regexp_replace(TRIM("periodo"), '^.+?\s+PARA\s+', '', 'i')))
  WHERE TRIM("periodo") ~* '^.+\s+PARA\s+.+$';

-- DropEnum
DROP TYPE "SceneShift";
