-- Quem do elenco vai ao set na diária (null = padrão: quem está nas cenas do dia).
ALTER TABLE "character_call_times" ADD COLUMN "presente" BOOLEAN;
