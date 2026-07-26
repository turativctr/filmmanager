import { z } from "zod";

export const sceneShootDayStatusSchema = z.object({
  status: z.enum(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "ADIADA"]),
});

export const sceneShootDayObservacoesSchema = z.object({
  observacoes: z.string().nullable(),
});
