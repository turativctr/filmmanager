import { z } from "zod";

export const shotScheduleAssignSchema = z.object({
  shotId: z.string().min(1),
  bloco: z.enum(["MANHA", "TARDE"]).optional().nullable(),
});

export const shotScheduleUpdateSchema = z.object({
  bloco: z.enum(["MANHA", "TARDE"]).optional().nullable(),
  // Ajuste calibrado por plano (nível 2 de "tempos de reset configuráveis"), pra este contexto de
  // ordem do dia — null volta a seguir o padrão do projeto. tipoReset/tempoResetMin continuam de
  // fora, sempre recalculados por recalculateDaySchedule() (src/lib/shots.ts).
  tempoResetMinManual: z.coerce.number().int().min(0).optional().nullable(),
});

export const shotScheduleReorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});
