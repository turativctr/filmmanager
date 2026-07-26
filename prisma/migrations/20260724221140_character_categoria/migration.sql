-- CreateEnum
CREATE TYPE "CharacterCategoria" AS ENUM ('PRINCIPAL', 'COADJUVANTE', 'PARTICIPACAO_ESPECIAL', 'FIGURACAO', 'VOZ_OFF', 'DUPLO', 'OUTRO');

-- AlterTable: adiciona a nova coluna preservando o sentido semântico dos dados existentes
-- (PRO = principal/protagonista, CHEF = coadjuvante/figurante caracterizado) em vez de
-- resetar todo mundo pro default — só personagens novos entram direto como PRINCIPAL.
ALTER TABLE "characters" ADD COLUMN "categoria" "CharacterCategoria";

UPDATE "characters"
SET "categoria" = CASE WHEN "tipo" = 'PRO' THEN 'PRINCIPAL'::"CharacterCategoria" ELSE 'COADJUVANTE'::"CharacterCategoria" END;

ALTER TABLE "characters" ALTER COLUMN "categoria" SET NOT NULL;
ALTER TABLE "characters" ALTER COLUMN "categoria" SET DEFAULT 'PRINCIPAL';

ALTER TABLE "characters" DROP COLUMN "tipo";

-- DropEnum
DROP TYPE "CharacterKind";
