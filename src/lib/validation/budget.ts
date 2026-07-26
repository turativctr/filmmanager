import { z } from "zod";

export const budgetSettingsSchema = z.object({
  moedaBase: z.string().min(1).optional(),
  versao: z.string().min(1).optional(),
  contingenciaPercentual: z.coerce.number().min(0).max(100).optional(),
  notas: z.string().optional().nullable(),
});

export const accountGroupSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  tipo: z.enum(["ATL", "BTL_PRODUCAO", "BTL_POS", "OUTROS"]),
  ordem: z.coerce.number().int().optional(),
});

export const budgetAccountSchema = z.object({
  groupId: z.string().min(1),
  codigo: z.string().min(1),
  nome: z.string().min(1),
  ordem: z.coerce.number().int().optional(),
});

export const lineItemSchema = z.object({
  accountId: z.string().min(1),
  descricao: z.string().min(1),
  quantidade: z.coerce.number(),
  unidade: z.string().min(1),
  periodo: z.coerce.number().default(1),
  taxa: z.coerce.number(),
  moeda: z.string().min(1).default("BRL"),
  taxaCambio: z.coerce.number().default(1.0),
  isFrengeable: z.coerce.boolean().default(false),
  globalRef: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
  ordem: z.coerce.number().int().optional(),
});

export const globalSchema = z.object({
  chave: z.string().min(1),
  valor: z.coerce.number(),
  descricao: z.string().optional().nullable(),
});

export const fringeSchema = z.object({
  nome: z.string().min(1),
  percentual: z.coerce.number(),
  teto: z.coerce.number().optional().nullable(),
  aplicaEm: z.array(z.string()).default([]),
  tipo: z.enum(["INSS", "FGTS", "ISS", "OUTRO"]),
});

export const scenarioOverrideSchema = z.object({
  chave: z.string().min(1),
  valor: z.coerce.number(),
});

export const scenarioSchema = z.object({
  nome: z.string().min(1),
  notas: z.string().optional().nullable(),
  isBase: z.coerce.boolean().optional(),
  overrides: z.array(scenarioOverrideSchema).default([]),
});

export const actualSchema = z.object({
  accountId: z.string().min(1),
  descricao: z.string().min(1),
  valor: z.coerce.number(),
  data: z.string().min(1),
  notas: z.string().optional().nullable(),
});

export type BudgetSettingsInput = z.infer<typeof budgetSettingsSchema>;
export type AccountGroupInput = z.infer<typeof accountGroupSchema>;
export type BudgetAccountInput = z.infer<typeof budgetAccountSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type GlobalInput = z.infer<typeof globalSchema>;
export type FringeInput = z.infer<typeof fringeSchema>;
export type ScenarioInput = z.infer<typeof scenarioSchema>;
export type ActualInput = z.infer<typeof actualSchema>;
