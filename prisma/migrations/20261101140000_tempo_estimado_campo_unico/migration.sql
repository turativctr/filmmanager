-- Tempo estimado e duração alvo viram um campo só: "Tempo estimado para gravação" grava em
-- duracaoAlvoMin (vazio = segue a soma dos planos). tempoEstimadoMin passa a ser cópia dele, pra
-- quem só lê o tempo da cena (tira, cronograma, PDFs) continuar igual. Só dados, sem mudar schema.

-- 1. Cena sem planos com tempo digitado: esse tempo vira o campo único. Com planos, o tempo
--    digitado já não valia (o Rod vinha da soma dos planos), então não é promovido — senão passaria
--    a mandar por cima dos planos.
UPDATE "scenes" s
SET "duracaoAlvoMin" = s."tempoEstimadoMin"
WHERE s."duracaoAlvoMin" IS NULL
  AND s."tempoEstimadoMin" >= 1
  AND NOT EXISTS (SELECT 1 FROM "shots" sh WHERE sh."sceneId" = s."id");

-- 2. tempoEstimadoMin = cópia do campo único.
UPDATE "scenes"
SET "tempoEstimadoMin" = "duracaoAlvoMin"
WHERE "tempoEstimadoMin" IS DISTINCT FROM "duracaoAlvoMin";
