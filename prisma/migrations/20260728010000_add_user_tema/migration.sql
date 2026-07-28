-- CreateEnum
CREATE TYPE "Tema" AS ENUM ('CLARO', 'NOIR', 'COMEDIA', 'HISTORICO');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "tema" "Tema" NOT NULL DEFAULT 'CLARO';
