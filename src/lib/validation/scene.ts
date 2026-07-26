import { z } from "zod";

import { isValidPaginasInput } from "@/lib/paginas";

export const sceneSchema = z.object({
  numero: z.string().min(1),
  tipo: z.enum(["INT", "EXT"]).optional().nullable(),
  periodo: z.enum(["DIA", "NOITE", "ENTARDECER", "AMANHECER", "CONTINUO", "DEPOIS"]).optional().nullable(),
  set: z.string().optional().nullable(),
  locacao: z.string().optional().nullable(),
  sinopse: z.string().optional().nullable(),
  paginas: z.string().refine(isValidPaginasInput, {
    message: "Formato inválido. Use frações de oitavo, ex.: 1 2/8",
  }),
  diaNarrativo: z.coerce.number().int().optional().nullable(),
  tempoEstimadoMin: z.coerce.number().int().optional().nullable(),
  notasAD: z.string().optional().nullable(),
  characterIds: z.array(z.string()).optional(),
});

export type SceneInput = z.infer<typeof sceneSchema>;

export const sceneSinopseADSchema = z.object({
  sinopseAD: z.string().optional().nullable(),
});
