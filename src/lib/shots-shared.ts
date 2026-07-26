import type { ShotStatus, ShotTipoReset } from "@prisma/client";

// Módulo sem dependência de prisma/Node — pode ser importado tanto no servidor (src/lib/shots.ts
// re-exporta tudo daqui) quanto direto em componentes cliente (ex.: shot-list-panel.tsx), já que
// @prisma/client puxaria código server-only pro bundle do navegador.

export const RESET_MINUTES: Record<ShotTipoReset, number> = {
  NENHUM: 0,
  AJUSTE: 3,
  TROCA_LENTE: 8,
  TROCA_CAMERA: 10,
  RESET_POSICAO: 15,
  RESET_COMPLETO: 20,
};

export const RESET_LABEL: Record<ShotTipoReset, string> = {
  NENHUM: "Nenhum",
  AJUSTE: "Ajuste",
  TROCA_LENTE: "Troca de lente",
  TROCA_CAMERA: "Troca de câmera",
  RESET_POSICAO: "Reset de posição",
  RESET_COMPLETO: "Reset completo",
};

/** Resets RESET_POSICAO/RESET_COMPLETO marcam ponto de atenção pra continuidade — ver PARTE 3. */
export const HEAVY_RESETS: ShotTipoReset[] = ["RESET_POSICAO", "RESET_COMPLETO"];

export type ShotResetInput = {
  lente?: string | null;
  angulo?: string | null;
  movimento?: string | null;
  tamanho?: string | null;
};

export type ShotResetResult = {
  tipoReset: ShotTipoReset;
  tempoResetMin: number;
};

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalize(value: string | null | undefined): string {
  return value ? stripAccents(value).trim().toLowerCase() : "";
}

function movementBucket(movimento: string | null | undefined): "ESTATICO" | "MOVIMENTO" | null {
  const n = normalize(movimento);
  if (!n) return null;
  return n.includes("estatic") || n.includes("fixo") || n.includes("tripe") ? "ESTATICO" : "MOVIMENTO";
}

// Escala de abertura do plano, do mais aberto (0) ao mais fechado (5) — usada só pra detectar
// mudança DRÁSTICA de tamanho (RESET_POSICAO/RESET_COMPLETO). Tamanhos fora dessa lista (texto
// livre não reconhecido) não entram na comparação, pra não gerar falso positivo.
const SIZE_SCALE: { bucket: number; keywords: string[] }[] = [
  { bucket: 0, keywords: ["plano geral", "geral", "conjunto", "estabelecimento"] },
  { bucket: 1, keywords: ["aberto", "plano americano"] },
  { bucket: 2, keywords: ["medio", "meio"] },
  { bucket: 3, keywords: ["fechado", "primeiro plano"] },
  { bucket: 4, keywords: ["close"] },
  { bucket: 5, keywords: ["detalhe", "insert"] },
];

function sizeBucket(tamanho: string | null | undefined): number | null {
  const n = normalize(tamanho);
  if (!n) return null;
  const words = new Set(n.split(/\s+/));
  for (const { bucket, keywords } of SIZE_SCALE) {
    for (const keyword of keywords) {
      const matches = keyword.includes(" ") ? n.includes(keyword) : words.has(keyword);
      if (matches) return bucket;
    }
  }
  return null;
}

/** Um plano é "Detalhe/Insert" quando o tamanho normalizado contém uma dessas palavras — usado
 *  pra forçar esses planos ao final da ordem sugerida (PARTE 6), independente do agrupamento por lente. */
export function isDetalheOuInsert(tamanho: string | null | undefined): boolean {
  const n = normalize(tamanho);
  return n.includes("detalhe") || n.includes("insert");
}

/** Compara um plano com o anterior e classifica o reset entre eles — PARTE 3 do pedido.
 *  Quando várias mudanças ocorrem ao mesmo tempo, vence o reset de maior tempo ("maior reset"). */
export function classifyReset(previous: ShotResetInput | null, current: ShotResetInput): ShotResetResult {
  if (!previous) return { tipoReset: "NENHUM", tempoResetMin: 0 };

  const lenteA = normalize(previous.lente);
  const lenteB = normalize(current.lente);
  const lensDiffers = lenteA !== lenteB && (lenteA !== "" || lenteB !== "");

  const anguloA = normalize(previous.angulo);
  const anguloB = normalize(current.angulo);
  const anguloDiffers = anguloA !== "" && anguloB !== "" && anguloA !== anguloB;

  const moveA = movementBucket(previous.movimento);
  const moveB = movementBucket(current.movimento);
  const movementCrosses = moveA !== null && moveB !== null && moveA !== moveB;

  const sizeA = sizeBucket(previous.tamanho);
  const sizeB = sizeBucket(current.tamanho);
  const tamanhoDrastic = sizeA !== null && sizeB !== null && Math.abs(sizeA - sizeB) >= 3;

  const candidates: ShotTipoReset[] = [];
  if (tamanhoDrastic && lensDiffers && anguloDiffers) candidates.push("RESET_COMPLETO");
  if (tamanhoDrastic) candidates.push("RESET_POSICAO");
  if (movementCrosses) candidates.push("TROCA_CAMERA");
  if (lensDiffers) candidates.push("TROCA_LENTE");
  if (anguloDiffers) candidates.push("AJUSTE");

  if (candidates.length === 0) return { tipoReset: "NENHUM", tempoResetMin: 0 };

  const tipoReset = candidates.reduce((max, c) => (RESET_MINUTES[c] > RESET_MINUTES[max] ? c : max));
  return { tipoReset, tempoResetMin: RESET_MINUTES[tipoReset] };
}

/** Aplica classifyReset em sequência a uma lista de planos já ordenada por `ordem`. */
export function recomputeResetsForOrderedShots<T extends ShotResetInput & { id: string }>(
  shots: T[]
): Map<string, ShotResetResult> {
  const results = new Map<string, ShotResetResult>();
  let previous: T | null = null;
  for (const shot of shots) {
    results.set(shot.id, classifyReset(previous, shot));
    previous = shot;
  }
  return results;
}

/** tempoTotalMin = (takesPrevistos × duracaoTakeMin) + tempoSetupMin — recalculado sempre que
 *  qualquer um dos três campos é salvo, nunca aceito como input direto da API. */
export function computeTempoTotal(takesPrevistos: number, duracaoTakeMin: number, tempoSetupMin: number): number {
  return takesPrevistos * duracaoTakeMin + tempoSetupMin;
}

/** Rod = soma(Shot.tempoTotalMin) + soma(Shot.tempoResetMin) dos planos PENDENTE/FILMADO —
 *  DESCARTADO não conta. Também retorna o total de takes previstos, usado no resumo da tira
 *  ("81min (6 planos · 18 takes)"). */
export function computeSceneShotTotals(
  shots: {
    tempoTotalMin: number | null;
    tempoResetMin: number | null;
    takesPrevistos: number | null;
    status: ShotStatus;
  }[]
): { planosMin: number; resetsMin: number; totalMin: number; count: number; takesTotal: number } {
  const active = shots.filter((s) => s.status !== "DESCARTADO");
  const planosMin = active.reduce((sum, s) => sum + (s.tempoTotalMin ?? 0), 0);
  const resetsMin = active.reduce((sum, s) => sum + (s.tempoResetMin ?? 0), 0);
  const takesTotal = active.reduce((sum, s) => sum + (s.takesPrevistos ?? 0), 0);
  return { planosMin, resetsMin, totalMin: planosMin + resetsMin, count: active.length, takesTotal };
}

// ---------------------------------------------------------------------------
// Controle por plano na OD (ShotSchedule) — planos de cenas diferentes intercalados na ordem do
// dia. As duas funções abaixo detectam pontos de atenção pra continuidade quando isso acontece.
// ---------------------------------------------------------------------------

export type DayOrderShot = {
  id: string;
  sceneNumero: string;
  shotNumero: string;
  sceneId: string;
};

export type ResumptionAlert = {
  sceneId: string;
  sceneNumero: string;
  /** Nº de segmentos não-contíguos em que a cena aparece na ordem do dia (2+ = retomada). */
  segments: number;
  /** Um alerta por retomada: o plano (do dia anterior) e o plano da cena que retoma. */
  transitions: { fromShotNumero: string; toSceneNumero: string; toShotNumero: string }[];
};

/** Agrupa a ordem do dia em segmentos contíguos por cena e sinaliza cenas que aparecem em 2+
 *  segmentos não-adjacentes — "retomada de cena" (PARTE — Continuidade na ordem reorganizada). */
export function detectResumptions(dayOrder: DayOrderShot[]): ResumptionAlert[] {
  if (dayOrder.length === 0) return [];

  const segments: DayOrderShot[][] = [];
  for (const shot of dayOrder) {
    const last = segments[segments.length - 1];
    if (last && last[0].sceneId === shot.sceneId) {
      last.push(shot);
    } else {
      segments.push([shot]);
    }
  }

  const bySceneSegments = new Map<string, DayOrderShot[][]>();
  for (const segment of segments) {
    const sceneId = segment[0].sceneId;
    const list = bySceneSegments.get(sceneId) ?? [];
    list.push(segment);
    bySceneSegments.set(sceneId, list);
  }

  const alerts: ResumptionAlert[] = [];
  for (const [sceneId, sceneSegments] of bySceneSegments) {
    if (sceneSegments.length < 2) continue;

    const transitions: ResumptionAlert["transitions"] = [];
    for (let i = 1; i < sceneSegments.length; i++) {
      const previousSegmentIndex = segments.findIndex((s) => s === sceneSegments[i]) - 1;
      const fromShot = segments[previousSegmentIndex]?.at(-1);
      const toShot = sceneSegments[i][0];
      if (fromShot) {
        transitions.push({
          fromShotNumero: fromShot.shotNumero,
          toSceneNumero: toShot.sceneNumero,
          toShotNumero: toShot.shotNumero,
        });
      }
    }

    alerts.push({
      sceneId,
      sceneNumero: sceneSegments[0][0].sceneNumero,
      segments: sceneSegments.length,
      transitions,
    });
  }

  return alerts;
}

export type PendingGapAlert = {
  sceneId: string;
  sceneNumero: string;
  filmedShotNumero: string;
  pendingShotNumeros: string[];
};

/** Pra cada cena com pelo menos um plano FILMADO, lista os demais planos da cena que ainda estão
 *  PENDENTE — a cena já começou a ser filmada mas não foi concluída (PARTE — Continuidade). */
export function detectPendingGaps(
  shotsByScene: Map<string, { id: string; ordem: number; numero: string; status: ShotStatus }[]>,
  sceneNumeroById: Map<string, string>
): PendingGapAlert[] {
  const alerts: PendingGapAlert[] = [];

  for (const [sceneId, shots] of shotsByScene) {
    const filmados = shots.filter((s) => s.status === "FILMADO");
    if (filmados.length === 0) continue;

    const lastFilmado = filmados.reduce((max, s) => (s.ordem > max.ordem ? s : max));
    const pending = shots.filter((s) => s.status === "PENDENTE");
    if (pending.length === 0) continue;

    alerts.push({
      sceneId,
      sceneNumero: sceneNumeroById.get(sceneId) ?? "?",
      filmedShotNumero: lastFilmado.numero,
      pendingShotNumeros: pending.map((s) => s.numero),
    });
  }

  return alerts;
}
