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
  // blocoManhaInicio/almocoInicio/almocoFim/blocoTardeInicio não são mais editáveis aqui — são
  // sempre derivados pelo servidor (chamadaGeral + Jornada do projeto + posição do marcador de
  // almoço no Stripboard), ver recalculateDayBlocks em src/lib/shootday-blocks.ts.
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

// Rota própria e minúscula (src/app/api/projects/[id]/shoot-days/[shootDayId]/reset-fator/
// route.ts) — de propósito SEPARADA de shootDaySchema acima, que exige numeroDia/data (não é
// .partial()); um PATCH parcial ali corromperia `data` (new Date(undefined)). Nível 3 de "tempos
// de reset configuráveis": ritmo dos resets DESTE dia, 100 = sem ajuste.
export const resetFatorSchema = z.object({
  fatorResetPercent: z.coerce.number().int().min(1).max(500),
});
