// Lógica pura (sem fetch/estado) de reordenação sugerida pra visão "Por plano" do Stripboard —
// cada função recebe a lista atual de ShotSchedule (já com `shot` populado) e devolve uma NOVA
// lista candidata; quem chama decide se aplica (POST /reorder) ou descarta.
import { isDetalheOuInsert, normalize, recomputeResetsForOrderedShots } from "@/lib/shots-shared";

import type { PlanoScheduleEntry } from "./types";

/** Agrupa preservando a ordem relativa dentro de cada grupo e a ordem de primeira aparição dos
 *  grupos — ex.: [A,B,A,C] agrupado por si mesmo vira [A,A,B,C]. */
export function stableGroupBy<T>(list: T[], keyFn: (item: T) => string): T[] {
  const order: string[] = [];
  const groups = new Map<string, T[]>();
  for (const item of list) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }
  return order.flatMap((key) => groups.get(key)!);
}

/** Move planos Detalhe/Insert pro final, preservando a ordem relativa dos demais e a ordem
 *  relativa entre os próprios planos movidos — regra do botão "Detalhes por último", também
 *  aplicada como passo final depois de "por lente"/"por tipo"/"por cena". */
export function moveDetalhesToEnd(list: PlanoScheduleEntry[]): PlanoScheduleEntry[] {
  const normal: PlanoScheduleEntry[] = [];
  const detalhes: PlanoScheduleEntry[] = [];
  for (const entry of list) {
    (isDetalheOuInsert(entry.shot.tamanho) ? detalhes : normal).push(entry);
  }
  return [...normal, ...detalhes];
}

// Categorização leve de `tamanho` em baldes grosseiros — espelha a escala interna de
// shots-shared.ts (sizeBucket), que não é exportada por ser específica da classificação de reset.
const TAMANHO_CATEGORIES: { label: string; keywords: string[] }[] = [
  { label: "Geral", keywords: ["plano geral", "geral", "conjunto", "estabelecimento"] },
  { label: "Aberto", keywords: ["aberto", "plano americano"] },
  { label: "Médio", keywords: ["medio", "meio"] },
  { label: "Fechado", keywords: ["fechado", "primeiro plano"] },
  { label: "Close", keywords: ["close"] },
  { label: "Detalhe", keywords: ["detalhe", "insert"] },
];

export function tamanhoCategory(tamanho: string | null | undefined): string {
  const n = normalize(tamanho);
  if (!n) return "outro";
  const words = new Set(n.split(/\s+/));
  for (const { label, keywords } of TAMANHO_CATEGORIES) {
    for (const keyword of keywords) {
      const matches = keyword.includes(" ") ? n.includes(keyword) : words.has(keyword);
      if (matches) return label;
    }
  }
  return "outro";
}

export function groupByLente(list: PlanoScheduleEntry[]): PlanoScheduleEntry[] {
  return moveDetalhesToEnd(stableGroupBy(list, (e) => normalize(e.shot.lente)));
}

export function groupByTipo(list: PlanoScheduleEntry[]): PlanoScheduleEntry[] {
  return moveDetalhesToEnd(stableGroupBy(list, (e) => tamanhoCategory(e.shot.tamanho)));
}

/** Ordem "cena, depois plano dentro da cena" — mesma lógica usada pra semear a ordem inicial do
 *  dia (PARTE 2) e pelo botão "Agrupar por cena". `sceneOrder` é a ordem das cenas no Stripboard
 *  (bloco manhã, depois tarde); cenas que não apareçam nela (dado desatualizado) vão pro final, na
 *  ordem em que aparecerem na lista atual. */
export function sceneThenShotOrder(list: PlanoScheduleEntry[], sceneOrder: string[]): PlanoScheduleEntry[] {
  const rank = new Map(sceneOrder.map((id, i) => [id, i]));
  const fallbackRank = new Map<string, number>();
  let fallbackNext = sceneOrder.length;
  for (const entry of list) {
    const sceneId = entry.shot.sceneId;
    if (!rank.has(sceneId) && !fallbackRank.has(sceneId)) {
      fallbackRank.set(sceneId, fallbackNext++);
    }
  }

  return list.slice().sort((a, b) => {
    const rankA = rank.get(a.shot.sceneId) ?? fallbackRank.get(a.shot.sceneId)!;
    const rankB = rank.get(b.shot.sceneId) ?? fallbackRank.get(b.shot.sceneId)!;
    if (rankA !== rankB) return rankA - rankB;
    return a.shot.ordem - b.shot.ordem;
  });
}

export function groupByCena(list: PlanoScheduleEntry[], sceneOrder: string[]): PlanoScheduleEntry[] {
  return moveDetalhesToEnd(sceneThenShotOrder(list, sceneOrder));
}

/** Soma tempoTotalMin (independe da ordem) + resets recalculados pra ORDEM passada — mesmo
 *  cálculo usado tanto pro total "atual" quanto pro total de cada candidato, pra ficarem
 *  comparáveis (PARTE 3, preview "Ordem atual: Xmin → Agrupado por Y: Zmin"). */
export function computeOrderTotalMin(list: PlanoScheduleEntry[]): number {
  const planosMin = list.reduce((sum, e) => sum + (e.shot.tempoTotalMin ?? 0), 0);
  const resetInputs = list.map((e) => ({
    id: e.id,
    lente: e.shot.lente,
    angulo: e.shot.angulo,
    movimento: e.shot.movimento,
    tamanho: e.shot.tamanho,
  }));
  const resets = recomputeResetsForOrderedShots(resetInputs);
  const resetsMin = Array.from(resets.values()).reduce((sum, r) => sum + r.tempoResetMin, 0);
  return planosMin + resetsMin;
}

/** Nº de trocas de lente na ordem atual — mesmo critério do classifyReset (lensDiffers): conta só
 *  quando pelo menos um dos dois planos tem lente preenchida. */
export function countLensChanges(list: PlanoScheduleEntry[]): number {
  let count = 0;
  for (let i = 1; i < list.length; i++) {
    const a = normalize(list[i - 1].shot.lente);
    const b = normalize(list[i].shot.lente);
    if (a !== b && (a !== "" || b !== "")) count++;
  }
  return count;
}

/** Mínimo teórico de trocas de lente pro multiset de lentes do dia: nº de lentes distintas - 1. */
export function minLensChanges(list: PlanoScheduleEntry[]): number {
  const distinct = new Set(list.map((e) => normalize(e.shot.lente)).filter((l) => l !== ""));
  return Math.max(0, distinct.size - 1);
}

export function formatMinDelta(delta: number): string {
  if (delta === 0) return "0min";
  return `${delta > 0 ? "+" : ""}${delta}min`;
}
