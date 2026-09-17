import type { ShotPrioridade, ShotStatus, ShotTipoReset } from "@prisma/client";

// Shape do Shot conforme retornado pelas rotas /shots (GET/POST/PATCH/DELETE/reorder) — todas
// devolvem a lista completa recalculada da cena. Campos extras do model (sceneId, projectId,
// createdAt, updatedAt) não são usados no client, mas passar o objeto do Prisma direto funciona
// já que TS permite propriedades extras em valores atribuídos (não é um literal).
export type ShotData = {
  id: string;
  ordem: number;
  numero: string;
  descricao: string;
  tamanho: string | null;
  lente: string | null;
  angulo: string | null;
  movimento: string | null;
  takesPrevistos: number;
  duracaoTakeMin: number;
  tempoSetupMin: number;
  tempoTotalMin: number;
  tempoResetMin: number | null;
  tempoResetMinManual: number | null;
  tipoReset: ShotTipoReset;
  notasDirecao: string | null;
  notasContinuidade: string | null;
  status: ShotStatus;
  /** Plano principal da cena (no máximo um). */
  ehMaster: boolean;
  /** O que pode cair quando a diária estoura. Coverage não herda do pai. */
  prioridade: ShotPrioridade;
  /** Plano do qual este é coverage — null = plano solto. Um nível só. */
  planoPaiId: string | null;
};
