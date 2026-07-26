import { z } from "zod";

export const callTimeEntrySchema = z.object({
  characterId: z.string().min(1),
  chamada: z.string().nullable().optional(),
  camarim: z.string().nullable().optional(),
  set: z.string().nullable().optional(),
  saida: z.string().nullable().optional(),
});

export const callTimesSchema = z.object({
  callTimes: z.array(callTimeEntrySchema),
});

export const checklistItemSchema = z.object({
  item: z.string().min(1),
  tipo: z.enum([
    "LOCACAO",
    "TRANSPORTE",
    "ELENCO",
    "ARTE",
    "SOM",
    "FIGURINO",
    "MAKE",
    "PLAYBACK",
    "OUTRO",
  ]),
});

export const checklistUpdateSchema = z.object({
  item: z.string().min(1).optional(),
  confirmado: z.boolean().optional(),
});
