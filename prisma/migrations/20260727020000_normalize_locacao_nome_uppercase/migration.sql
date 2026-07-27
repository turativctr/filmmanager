-- Normaliza Locacao.nome para maiúscula (convenção de set), preservando acentos.
-- UPPER() sozinho não funciona pra letras acentuadas nesta collation ("C"/POSIX) — mesmo
-- problema já visto na migração anterior com LOWER(). Por isso, primeiro troca as minúsculas
-- acentuadas pelas maiúsculas equivalentes via TRANSLATE(), depois aplica UPPER() pro resto
-- (letras ASCII sem acento, que o UPPER() já resolve em qualquer collation).
UPDATE "locacoes"
SET "nome" = UPPER(
  TRANSLATE(
    "nome",
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ'
  )
)
WHERE "nome" <> UPPER(
  TRANSLATE(
    "nome",
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ'
  )
);
