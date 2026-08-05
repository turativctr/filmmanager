-- Onda 4: renomeia o valor do enum (não os dados) — registros existentes com tema='EXPERIMENTAL'
-- passam a ler 'FUTURISTA' automaticamente, sem precisar de UPDATE manual (mesmo mecanismo do
-- rename CLARO -> DOCUMENTARIO na onda 3).
ALTER TYPE "Tema" RENAME VALUE 'EXPERIMENTAL' TO 'FUTURISTA';
