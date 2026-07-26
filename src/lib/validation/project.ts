import { z } from "zod";

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
  duracaoAlmocoMin: z.coerce.number().int().min(1).optional(),
  preparacaoInicialMin: z.coerce.number().int().min(0).optional(),
});

export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
