import { z } from "zod";

const faixaSchema = z
  .object({ min: z.coerce.number().int().min(1).max(600), max: z.coerce.number().int().min(1).max(600) })
  .refine((f) => f.max >= f.min, { message: "O fim da faixa não pode ser menor que o começo." });

export const faixasTempoSchema = z.object({
  DIALOGO_ESTATICO: z.object({ porPlano: faixaSchema, porOitavo: faixaSchema }),
  COM_MOVIMENTO: z.object({ porPlano: faixaSchema, porOitavo: faixaSchema }),
  EFEITO_VFX: z.object({ porPlano: faixaSchema, porOitavo: faixaSchema }),
  EXTERIOR: z.object({ porPlano: faixaSchema, porOitavo: faixaSchema }),
});


export const projectUpdateSchema = z.object({
  // Opcional pra suportar updates parciais (ex.: ProjectLifecycleMenu só manda status/arquivado) —
  // o formulário de edição completo sempre envia titulo de qualquer forma.
  titulo: z.string().min(1).optional(),
  diretor: z.string().optional().nullable(),
  producao: z.string().optional().nullable(),
  dataInicio: z.string().optional().nullable(),
  dataFim: z.string().optional().nullable(),
  equipeTecnica: z.coerce.number().int().min(0).optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  sistemaIdElenco: z.enum(["ID_CURTO", "NUMERACAO"]).optional(),
  status: z.enum(["ATIVO", "CONCLUIDO"]).optional(),
  arquivado: z.boolean().optional(),
  sigla: z.string().trim().max(10).regex(/^\S*$/, "Sigla não pode conter espaços.").optional().nullable(),
  continuismoResponsavel: z.string().optional(),
  continuismoUsarLogo: z.boolean().optional(),
  continuismoLinhasPorFolha: z.coerce.number().int().min(1).optional(),
  limiteAlmocoMin: z.coerce.number().int().min(1).optional(),
  // Pontos de partida por tipo de cena (estágio 3 da estimativa). A produção ajusta uma vez e a
  // orientação passa a ser da equipe dela, não um chute do app. Ver src/lib/estimativa.ts.
  faixasTempo: faixasTempoSchema.optional(),
  duracaoAlmocoMin: z.coerce.number().int().min(1).optional(),
  preparacaoInicialMin: z.coerce.number().int().min(0).optional(),
  // Tempos de reset configuráveis, nível 1 — padrão do projeto por tipo classificado (ver
  // src/lib/shots-shared.ts). NENHUM não entra aqui, é sempre zero.
  resetAjusteMin: z.coerce.number().int().min(0).optional(),
  resetTrocaLenteMin: z.coerce.number().int().min(0).optional(),
  resetTrocaCameraMin: z.coerce.number().int().min(0).optional(),
  resetPosicaoMin: z.coerce.number().int().min(0).optional(),
  resetCompletoMin: z.coerce.number().int().min(0).optional(),
});

export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
