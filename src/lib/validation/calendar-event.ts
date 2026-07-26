import { z } from "zod";

export const calendarEventSchema = z.object({
  data: z.string().min(1),
  tipo: z.enum(["ENSAIO", "VIAGEM", "FIGURINO", "FERIADO", "FOLGA", "OUTRO"]),
  nome: z.string().min(1),
  elementosAfetados: z.array(z.string()).optional(),
});

export type CalendarEventInput = z.infer<typeof calendarEventSchema>;
