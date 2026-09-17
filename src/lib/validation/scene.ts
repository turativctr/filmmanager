import { z } from "zod";

import { isValidPaginasInput } from "@/lib/paginas";

export const sceneSchema = z.object({
  numero: z.string().min(1),
  tipo: z.enum(["INT", "EXT"]).optional().nullable(),
  // Texto livre — ver o comentário em FdxScene.periodo (src/lib/fdx-parser.ts) pro porquê não é
  // mais um enum fechado. classeLuz/periodoFim NÃO vêm do cliente: são sempre derivados aqui no
  // servidor (ver deriveClasseLuz), nunca aceitos como entrada direta do formulário.
  periodo: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v.trim().toUpperCase() : v || null)),
  set: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v.trim().toUpperCase() : v)),
  locacaoId: z.string().optional().nullable(),
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

// Tempo reverso (Scene.duracaoAlvoMin). null apaga e volta ao Rod pela soma dos planos. 0 não é
// aceito: cena nunca roda em zero minutos, e "0" num campo desses quase sempre é digitação.
export const sceneDuracaoAlvoSchema = z.object({
  duracaoAlvoMin: z.number().int().min(1).max(24 * 60).nullable(),
});

export const sceneSinopseADSchema = z.object({
  sinopseAD: z.string().optional().nullable(),
});
