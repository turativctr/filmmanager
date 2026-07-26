import { z } from "zod";

const stringList = z.array(z.string()).optional();

export const breakdownSchema = z.object({
  tempoEstimadoMin: z.coerce.number().int().optional().nullable(),
  characterIds: z.array(z.string()).optional(),
  extraLinks: z.array(z.object({ extraId: z.string(), linked: z.boolean() })).optional(),
  figurino: stringList,
  make: stringList,
  arteDressing: z.string().optional().nullable(),
  objetos: stringList,
  comidaCena: stringList,
  microfones: stringList,
  trilha: stringList,
  habilidades: stringList,
  arteGrafica: stringList,
  posProducao: stringList,
  notasArte: z.string().optional().nullable(),
  notasFoto: z.string().optional().nullable(),
  notasSom: z.string().optional().nullable(),
  notasContinuidade: z.string().optional().nullable(),
  notasProducao: z.string().optional().nullable(),
});

export type BreakdownInput = z.infer<typeof breakdownSchema>;
