import { z } from "zod";

// tipoReset/tempoResetMin/tempoTotalMin não entram aqui — são sempre recalculados no servidor
// (tempoTotalMin = takesPrevistos × duracaoTakeMin + tempoSetupMin; tipoReset/tempoResetMin por
// recalculateScene()/recalculateDaySchedule() em src/lib/shots.ts), nunca aceitos como input direto.
// tempoResetMinManual É aceito — é o ajuste calibrado por plano (nível 2 de "tempos de reset
// configuráveis"); null volta a seguir o padrão do projeto ("usar padrão do projeto").
// `numero` também não entra: é a identidade do plano na decupagem/claquete e é sempre atribuído pelo
// servidor (próximo número livre ao criar; letra do pai ao virar coverage; próximo livre ao
// desvincular) — nunca derivado da posição, nunca aceito do cliente. Ver nextFreeShotNumero e
// coverageShotNumero em src/lib/shots-shared.ts.
export const shotSchema = z.object({
  descricao: z.string().min(1),
  tamanho: z.string().trim().optional().nullable(),
  lente: z.string().trim().optional().nullable(),
  angulo: z.string().trim().optional().nullable(),
  movimento: z.string().trim().optional().nullable(),
  takesPrevistos: z.coerce.number().int().min(1).optional(),
  duracaoTakeMin: z.coerce.number().int().min(0).optional(),
  tempoSetupMin: z.coerce.number().int().min(0).optional(),
  tempoResetMinManual: z.coerce.number().int().min(0).optional().nullable(),
  notasDirecao: z.string().optional().nullable(),
  notasContinuidade: z.string().optional().nullable(),
  status: z.enum(["PENDENTE", "FILMADO", "DESCARTADO"]).optional(),
});

// Edição: os campos de cima (todos opcionais) + hierarquia master/coverage, que só existe depois do
// plano criado. planoPaiId: string = vira coverage daquele plano; null = volta pra lista plana;
// ausente = não mexe.
export const shotPatchSchema = shotSchema.partial().extend({
  ehMaster: z.boolean().optional(),
  planoPaiId: z.string().min(1).nullable().optional(),
});

export type ShotInput = z.infer<typeof shotPatchSchema>;

export const shotReorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});
