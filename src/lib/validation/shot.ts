import { z } from "zod";

// tipoReset/tempoResetMin/tempoTotalMin não entram aqui — são sempre recalculados no servidor
// (tempoTotalMin = takesPrevistos × duracaoTakeMin + tempoSetupMin; tipoReset/tempoResetMin por
// recalculateScene()/recalculateDaySchedule() em src/lib/shots.ts), nunca aceitos como input direto.
export const shotSchema = z.object({
  numero: z.string().min(1),
  descricao: z.string().min(1),
  tamanho: z.string().trim().optional().nullable(),
  lente: z.string().trim().optional().nullable(),
  angulo: z.string().trim().optional().nullable(),
  movimento: z.string().trim().optional().nullable(),
  takesPrevistos: z.coerce.number().int().min(1).optional(),
  duracaoTakeMin: z.coerce.number().int().min(0).optional(),
  tempoSetupMin: z.coerce.number().int().min(0).optional(),
  notasDirecao: z.string().optional().nullable(),
  notasContinuidade: z.string().optional().nullable(),
  status: z.enum(["PENDENTE", "FILMADO", "DESCARTADO"]).optional(),
});

export type ShotInput = z.infer<typeof shotSchema>;

export const shotReorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});
