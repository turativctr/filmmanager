-- Renomeia o valor do enum (não os dados) — registros existentes com tema='CLARO' passam a ler
-- 'DOCUMENTARIO' automaticamente, sem precisar de UPDATE manual.
ALTER TYPE "Tema" RENAME VALUE 'CLARO' TO 'DOCUMENTARIO';
