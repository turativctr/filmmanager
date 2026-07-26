-- AlterTable
ALTER TABLE "character_call_times" ADD COLUMN     "camarim" TEXT,
ADD COLUMN     "set" TEXT;

-- AlterTable
ALTER TABLE "shoot_days" ADD COLUMN     "baseInfo" TEXT,
ADD COLUMN     "chamadaEquipe" JSONB,
ADD COLUMN     "estacionamento" TEXT,
ADD COLUMN     "hospitalEndereco" TEXT,
ADD COLUMN     "hospitalNome" TEXT,
ADD COLUMN     "hospitalTelefone" TEXT,
ADD COLUMN     "lancheHorario" TEXT,
ADD COLUMN     "locacaoEndereco" TEXT,
ADD COLUMN     "locacaoNome" TEXT,
ADD COLUMN     "meteoChuva" TEXT,
ADD COLUMN     "meteoDescricao" TEXT,
ADD COLUMN     "meteoMax" INTEGER,
ADD COLUMN     "meteoMin" INTEGER,
ADD COLUMN     "meteoNascer" TEXT,
ADD COLUMN     "meteoPor" TEXT,
ADD COLUMN     "observacoesGerais" TEXT,
ADD COLUMN     "transporteEndereco" TEXT,
ADD COLUMN     "transporteHorario" TEXT;
