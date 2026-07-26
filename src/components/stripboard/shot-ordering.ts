// Lógica pura de reordenação sugerida pra visão unificada do Stripboard (botões de cabeçalho da
// diária — "Agrupar por lente" / "Agrupar por tipo" / "Detalhes por último" / "Resetar ordem").
// Diferente de plano-view/grouping.ts (que opera sobre ShotSchedule.ordem, cruzando cenas), estas
// funções operam sobre Shot.ordem DENTRO DE UMA ÚNICA CENA — reaproveita os blocos genéricos já
// existentes (stableGroupBy, tamanhoCategory) em vez de duplicar a heurística de agrupamento.
import { computeSceneShotTotals, isDetalheOuInsert, normalize, recomputeResetsForOrderedShots } from "@/lib/shots-shared";
import { naturalCompare } from "@/lib/natural-sort";

import { stableGroupBy, tamanhoCategory } from "./plano-view/grouping";

import type { ShotStatus, ShotTipoReset } from "@prisma/client";

export type OrderableShot = {
  id: string;
  numero: string;
  tamanho: string | null;
  lente: string | null;
  angulo: string | null;
  movimento: string | null;
  tempoTotalMin: number;
  tempoResetMin: number | null;
  tipoReset: ShotTipoReset;
  takesPrevistos: number;
  status: ShotStatus;
};

function moveDetalhesToEnd<T extends { tamanho: string | null }>(list: T[]): T[] {
  const normal: T[] = [];
  const detalhes: T[] = [];
  for (const item of list) (isDetalheOuInsert(item.tamanho) ? detalhes : normal).push(item);
  return [...normal, ...detalhes];
}

export function groupByLente<T extends OrderableShot>(list: T[]): T[] {
  return moveDetalhesToEnd(stableGroupBy(list, (i) => normalize(i.lente)));
}

export function groupByTipo<T extends OrderableShot>(list: T[]): T[] {
  return moveDetalhesToEnd(stableGroupBy(list, (i) => tamanhoCategory(i.tamanho)));
}

export function detalhesPorUltimo<T extends OrderableShot>(list: T[]): T[] {
  return moveDetalhesToEnd(list);
}

/** "Resetar ordem" — volta pra ordem natural do número do plano (P1, P2, P3...), desfazendo
 *  qualquer agrupamento por lente/tipo aplicado anteriormente. */
export function resetarOrdem<T extends OrderableShot>(list: T[]): T[] {
  return list.slice().sort((a, b) => naturalCompare(a.numero, b.numero));
}

/** Recalcula planos + resets pra uma ordem hipotética de planos de UMA cena — mesmo cálculo usado
 *  tanto pro total "atual" quanto pro total de cada candidato, pra ficarem comparáveis no preview
 *  agregado dos botões de agrupamento (soma entre cenas afetadas). */
export function computeShotsOrderTotalMin(list: OrderableShot[]): number {
  const resets = recomputeResetsForOrderedShots(list);
  const enriched = list.map((shot) => ({
    tempoTotalMin: shot.tempoTotalMin,
    tempoResetMin: resets.get(shot.id)?.tempoResetMin ?? 0,
    takesPrevistos: shot.takesPrevistos,
    status: shot.status,
  }));
  return computeSceneShotTotals(enriched).totalMin;
}

export function formatMinDelta(delta: number): string {
  if (delta === 0) return "0min";
  return `${delta > 0 ? "+" : ""}${delta}min`;
}
