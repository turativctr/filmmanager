-- CreateEnum
CREATE TYPE "SistemaIdElenco" AS ENUM ('ID_CURTO', 'NUMERACAO');

-- CreateEnum
CREATE TYPE "HoraAHoraEventTipo" AS ENUM ('CHAMADA_EQUIPE', 'CHAMADA_ELENCO', 'SETUP', 'ENSAIO', 'RODANDO', 'ALMOCO', 'SAIDA', 'DESPRODUCAO', 'OUTRO');

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "numeroElenco" INTEGER;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "sistemaIdElenco" "SistemaIdElenco" NOT NULL DEFAULT 'ID_CURTO';

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "notasAD" TEXT;

-- AlterTable
ALTER TABLE "shoot_days" ADD COLUMN     "observacaoCronogramaElenco" TEXT,
ADD COLUMN     "observacaoPlanoSimples" TEXT;

-- CreateTable
CREATE TABLE "hora_a_hora_events" (
    "id" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT,
    "descricao" TEXT NOT NULL,
    "tipo" "HoraAHoraEventTipo" NOT NULL,
    "geradoAutomaticamente" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hora_a_hora_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "hora_a_hora_events" ADD CONSTRAINT "hora_a_hora_events_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "shoot_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
