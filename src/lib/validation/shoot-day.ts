import { z } from "zod";

const timeField = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .optional()
  .nullable();

const textField = z.string().optional().nullable();

const intField = z.coerce.number().int().optional().nullable();

export const shootDaySchema = z.object({
  numeroDia: z.coerce.number().int().min(1),
  data: z.string().min(1),
  chamadaGeral: timeField,
  lancheHorario: timeField,
  blocoManhaInicio: timeField,
  almocoInicio: timeField,
  almocoFim: timeField,
  blocoTardeInicio: timeField,
  desprodInicio: timeField,

  // Logística — Call Sheet
  transporteHorario: timeField,
  transporteEndereco: textField,
  locacaoNome: textField,
  locacaoEndereco: textField,
  baseInfo: textField,
  estacionamento: textField,
  hospitalNome: textField,
  hospitalEndereco: textField,
  hospitalTelefone: textField,
  meteoNascer: timeField,
  meteoPor: timeField,
  meteoMin: intField,
  meteoMax: intField,
  meteoChuva: textField,
  meteoDescricao: textField,
  chamadaEquipe: z.record(z.string(), z.string()).optional(),
  observacoesGerais: textField,
  observacaoCronogramaElenco: textField,
  observacaoPlanoSimples: textField,
});

export type ShootDayInput = z.infer<typeof shootDaySchema>;
