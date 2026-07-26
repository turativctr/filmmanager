import { z } from "zod";

export const dailyProgressReportSchema = z.object({
  cenasConcluidas: z.array(z.string()).default([]),
  cenasNaoConcluidas: z.array(z.string()).default([]),
  paginasFilmadas: z.coerce.number().nonnegative().default(0),
  horaInicioReal: z.string().optional().nullable(),
  horaTerminoReal: z.string().optional().nullable(),
  atrasoMin: z.coerce.number().int().optional().nullable(),
  motivoAtraso: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export type DailyProgressReportInput = z.infer<typeof dailyProgressReportSchema>;
