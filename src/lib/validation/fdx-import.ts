import { z } from "zod";

export const fdxSceneSchema = z.object({
  numero: z.string().min(1),
  numeroGerado: z.boolean().default(false),
  tipo: z.enum(["INT", "EXT"]).nullable(),
  // Texto livre — ver o comentário em FdxScene.periodo (src/lib/fdx-parser.ts) pro porquê não é
  // mais um enum fechado.
  periodo: z.string().nullable(),
  periodoFim: z.string().nullable(),
  classeLuz: z.enum(["DIA", "NOITE", "TRANSICAO", "INDEFINIDO"]),
  set: z.string().nullable(),
  // Sempre populado por ambos os parsers agora (ver comentário em FdxScene.locacaoNome) —
  // nullable só pro caso raro de cabeçalho sem local nenhum, não mais opcional.
  locacaoNome: z.string().nullable(),
  sinopse: z.string().nullable(),
  personagens: z.array(z.string()),
  personagensSemFala: z.array(z.string()).optional(),
  paginas: z.number().nonnegative(),
  linhas: z.number().int().nonnegative(),
  tempoEstimadoMinSugerido: z.number().int().nonnegative(),
});

export const fdxImportConfirmSchema = z.object({
  scenes: z.array(fdxSceneSchema).min(1),
  substituirExistentes: z.boolean().default(false),
  criarPersonagens: z.boolean().default(true),
});

export type FdxImportConfirmInput = z.infer<typeof fdxImportConfirmSchema>;
