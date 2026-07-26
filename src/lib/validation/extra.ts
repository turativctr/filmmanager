import { z } from "zod";

export const extraSchema = z.object({
  personagem: z.string().min(1),
  quantidade: z.coerce.number().int().min(1),
  chamada: z.string().optional().nullable(),
  saida: z.string().optional().nullable(),
  cenaIds: z.array(z.string()).optional(),
});

export type ExtraInput = z.infer<typeof extraSchema>;
