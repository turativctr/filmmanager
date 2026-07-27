-- Normaliza Scene.set para maiúscula (mesma regra e mesmo motivo do TRANSLATE() já usado
-- pra Locacao.nome): UPPER() sozinho não rebaixa acento sob a collation "C"/POSIX deste
-- banco, então troca primeiro as minúsculas acentuadas pelas maiúsculas equivalentes.
UPDATE "scenes"
SET "set" = UPPER(
  TRANSLATE(
    "set",
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ'
  )
)
WHERE "set" IS NOT NULL
  AND "set" <> UPPER(
    TRANSLATE(
      "set",
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ'
    )
  );
