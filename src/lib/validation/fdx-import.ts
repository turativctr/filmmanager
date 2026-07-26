import { z } from "zod";

export const fdxSceneSchema = z.object({
  numero: z.string().min(1),
  numeroGerado: z.boolean().default(false),
  tipo: z.enum(["INT", "EXT"]).nullable(),
  periodo: z.enum(["DIA", "NOITE", "ENTARDECER", "AMANHECER", "CONTINUO", "DEPOIS"]).nullable(),
  set: z.string().nullable(),
  sinopse: z.string().nullable(),
  personagens: z.array(z.string()),
  paginas: z.number().nonnegative(),
  tempoEstimadoMinSugerido: z.number().int().nonnegative(),
});

export const fdxImportConfirmSchema = z.object({
  scenes: z.array(fdxSceneSchema).min(1),
  substituirExistentes: z.boolean().default(false),
  criarPersonagens: z.boolean().default(true),
});

export type FdxImportConfirmInput = z.infer<typeof fdxImportConfirmSchema>;
