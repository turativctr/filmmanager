import { z } from "zod";

const horaReal = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

// Uma linha por cena (ou parte de cena dividida) e por bloco de tempo da diária. A tela manda a
// diária inteira de uma vez: a AD preenche o que anotou e salva uma vez só.
const linhaCena = z.object({
  tipo: z.literal("CENA"),
  sceneId: z.string().min(1),
  scenePartId: z.string().min(1).nullable().optional(),
  horaInicioReal: horaReal,
  horaFimReal: horaReal,
  naoRealizada: z.boolean().optional(),
});

const linhaBloco = z.object({
  tipo: z.literal("BLOCO"),
  blocoId: z.string().min(1),
  horaInicioReal: horaReal,
  horaFimReal: horaReal,
});

export const lancamentoRealizadoSchema = z.object({
  linhas: z.array(z.discriminatedUnion("tipo", [linhaCena, linhaBloco])).min(1),
});

export type LancamentoRealizadoInput = z.infer<typeof lancamentoRealizadoSchema>;
