import { z } from "zod";

export const characterSchema = z.object({
  idCurto: z.string().min(1),
  categoria: z.enum([
    "PRINCIPAL",
    "COADJUVANTE",
    "PARTICIPACAO_ESPECIAL",
    "FIGURACAO",
    "VOZ_OFF",
    "DUPLO",
    "OUTRO",
  ]),
  personagem: z.string().min(1),
  ator: z.string().optional().nullable(),
  idadePersonagem: z.coerce.number().int().optional().nullable(),
  cacheeDiario: z.coerce.number().nonnegative().optional().nullable(),
  percentualHold: z.coerce.number().min(0).max(100).optional().nullable(),
  sceneIds: z.array(z.string()).optional(),
});

export type CharacterInput = z.infer<typeof characterSchema>;
