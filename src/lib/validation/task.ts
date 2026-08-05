import { z } from "zod";

export const taskSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().optional().nullable(),
  prazo: z.coerce.date(),
  responsavel: z.string().optional().nullable(),
  concluida: z.boolean().optional(),
});

// PATCH aceita qualquer subconjunto dos campos — inclusive só { concluida } pro toggle no
// Calendário/home, sem precisar reenviar título/prazo/etc.
export const taskUpdateSchema = taskSchema.partial();

export type TaskInput = z.infer<typeof taskSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
