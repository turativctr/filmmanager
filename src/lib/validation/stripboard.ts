import { z } from "zod";

export const stripboardChangeSchema = z.object({
  sceneId: z.string(),
  // Parte da cena dividida que esta tira agenda; null/ausente = cena inteira.
  scenePartId: z.string().nullable().optional(),
  shootDayId: z.string().nullable(),
  bloco: z.enum(["MANHA", "TARDE"]).nullable(),
  ordem: z.number().int(),
  prepMin: z.number().int().nullable().optional(),
  rodMin: z.number().int().nullable().optional(),
});

// Bloco de tempo (ShootDayBlock) só muda de posição DENTRO da própria diária — `ordem` é a posição
// na lista do dia, na mesma sequência das cenas.
export const stripboardBlocoChangeSchema = z.object({
  id: z.string(),
  shootDayId: z.string(),
  ordem: z.number().int(),
  bloco: z.enum(["MANHA", "TARDE"]),
});

export const stripboardReorderSchema = z.object({
  changes: z.array(stripboardChangeSchema),
  blocos: z.array(stripboardBlocoChangeSchema).optional(),
});

export type StripboardChange = z.infer<typeof stripboardChangeSchema>;
