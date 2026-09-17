import type { ShotPrioridade, ShotStatus, ShotTipoReset } from "@prisma/client";

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

// Tempos de reset configuráveis, nível 1 (padrão do projeto) — classifyReset() abaixo continua
// usando RESET_MINUTES pra decidir qual TIPO vence quando há vários gatilhos ao mesmo tempo (o
// ranking de severidade nunca muda com a config do projeto, só o minuto do tipo já escolhido é
// substituído depois, em recalculateScene/recalculateDaySchedule — src/lib/shots.ts). NENHUM não
// tem campo no Project (é sempre zero).
export type ResetMinutesConfig = Record<ShotTipoReset, number>;

export function buildResetMinutesConfig(project: {
  resetAjusteMin: number;
  resetTrocaLenteMin: number;
  resetTrocaCameraMin: number;
  resetPosicaoMin: number;
  resetCompletoMin: number;
}): ResetMinutesConfig {
  return {
    NENHUM: 0,
    AJUSTE: project.resetAjusteMin,
    TROCA_LENTE: project.resetTrocaLenteMin,
    TROCA_CAMERA: project.resetTrocaCameraMin,
    RESET_POSICAO: project.resetPosicaoMin,
    RESET_COMPLETO: project.resetCompletoMin,
  };
}

/** Ordem de cálculo do tempo de reset efetivo: (1) ajuste manual do plano, se existir, senão (2) o
 *  valor computado (padrão do projeto pro tipo classificado); em ambos os casos, (3) multiplica
 *  pelo fator do dia (nível 3 — ShootDay.fatorResetPercent, 100 = sem ajuste) e arredonda pro
 *  minuto inteiro mais próximo. O fator só existe em contexto com uma ShootDay específica em
 *  escopo — quem não tiver um fator real disponível (ex.: página de Breakdown, que é
 *  independente de dia) passa 100. */
export function resolveEffectiveResetMin(
  computedMin: number,
  manualMin: number | null | undefined,
  fatorPercent: number
): number {
  const base = manualMin ?? computedMin;
  return Math.round((base * fatorPercent) / 100);
}

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

/** Rod = soma(Shot.tempoTotalMin) + soma(ajuste manual ?? Shot.tempoResetMin) dos planos
 *  PENDENTE/FILMADO — DESCARTADO não conta. Usa o ajuste manual (nível 2) quando existir, porque é
 *  uma calibração real da duração da cena; NUNCA aplica o fator do dia (nível 3) aqui — o fator é
 *  decisão de ritmo "só por hoje", não pode vazar pro Rod/cronograma mestre (blocoManha/almoço).
 *  Também retorna o total de takes previstos, usado no resumo da tira ("81min (6 planos · 18
 *  takes)"). */
export function computeSceneShotTotals(
  shots: {
    tempoTotalMin: number | null;
    tempoResetMin: number | null;
    tempoResetMinManual?: number | null;
    takesPrevistos: number | null;
    status: ShotStatus;
  }[]
): { planosMin: number; resetsMin: number; totalMin: number; count: number; takesTotal: number } {
  const active = shots.filter((s) => s.status !== "DESCARTADO");
  const planosMin = active.reduce((sum, s) => sum + (s.tempoTotalMin ?? 0), 0);
  const resetsMin = active.reduce((sum, s) => sum + (s.tempoResetMinManual ?? s.tempoResetMin ?? 0), 0);
  const takesTotal = active.reduce((sum, s) => sum + (s.takesPrevistos ?? 0), 0);
  return { planosMin, resetsMin, totalMin: planosMin + resetsMin, count: active.length, takesTotal };
}

// ---------------------------------------------------------------------------
// Prioridade do plano — o que pode cair quando a diária estoura
// ---------------------------------------------------------------------------

export const PRIORIDADE_LABEL: Record<ShotPrioridade, string> = {
  ESSENCIAL: "Essencial",
  DESEJAVEL: "Desejável",
  SE_DER_TEMPO: "Se der tempo",
};

/** Inicial pra coluna estreita de PDF: E / D / T. */
export const PRIORIDADE_INICIAL: Record<ShotPrioridade, string> = {
  ESSENCIAL: "E",
  DESEJAVEL: "D",
  SE_DER_TEMPO: "T",
};

export const PRIORIDADE_DESCRICAO: Record<ShotPrioridade, string> = {
  ESSENCIAL: "Sem ele a cena não monta",
  DESEJAVEL: "Melhora, mas a cena fecha sem ele",
  SE_DER_TEMPO: "Primeiro a cair",
};

export const PRIORIDADES: ShotPrioridade[] = ["ESSENCIAL", "DESEJAVEL", "SE_DER_TEMPO"];

/** Minutos em planos que podem cair (DESEJAVEL + SE_DER_TEMPO) — responde "quanto economizo se
 *  cortar isso", consultado quando a diária estoura. Mesma regra de soma do Rod (planos + resets, sem
 *  descartados), filtrando os não-essenciais e os já FILMADOS: cortar o que já foi filmado não
 *  economiza nada, e contá-lo faria o número mentir pra maior justo na hora de decidir. Coverage tem
 *  prioridade própria: não herda a do pai. */
export function computeCortaveisMin(
  shots: (Parameters<typeof computeSceneShotTotals>[0][number] & { prioridade: ShotPrioridade })[]
): number {
  return computeSceneShotTotals(shots.filter((s) => s.prioridade !== "ESSENCIAL" && s.status !== "FILMADO")).totalMin;
}

// ---------------------------------------------------------------------------
// Rod da cena — de onde vem o número (uma regra só, usada pra gravar e pra rotular na tela)
// ---------------------------------------------------------------------------

export type FonteRod = "DEFINIDO" | "PLANOS" | "ESTIMADO";

/** O que gravar em SceneShootDay.rodMin, e por quê:
 *  - duração alvo definida → ela, com ou sem planos (a soma vira só base do aviso de estouro);
 *  - sem alvo, com planos → soma dos planos (planos + resets, sem descartados);
 *  - sem alvo e sem planos → null, que resolveEffectiveRodMin resolve pro tempo estimado pelos
 *    oitavos. Grava null (e não o estimado em si) pra que editar os oitavos depois continue
 *    refletindo no cronograma. */
export function resolveRodDaCena({
  duracaoAlvoMin,
  planos,
}: {
  duracaoAlvoMin: number | null;
  planos: Parameters<typeof computeSceneShotTotals>[0];
}): { rodMin: number | null; fonte: FonteRod } {
  if (duracaoAlvoMin != null) return { rodMin: duracaoAlvoMin, fonte: "DEFINIDO" };
  if (planos.length > 0) return { rodMin: computeSceneShotTotals(planos).totalMin, fonte: "PLANOS" };
  return { rodMin: null, fonte: "ESTIMADO" };
}

// ---------------------------------------------------------------------------
// Master / coverage — hierarquia OPCIONAL de um nível por cima da lista plana de planos.
// ---------------------------------------------------------------------------

export type ShotHierarchyInput = { id: string; planoPaiId: string | null };

/** Reagrupa uma ordem plana de planos pra manter cada coverage logo abaixo do seu pai, na ordem
 *  relativa em que os coverages já estavam. Planos soltos (e pais) ficam na ordem em que aparecem.
 *  É isto que faz "arrastar o pai leva os filhos": basta mover o pai na lista plana e reagrupar.
 *  Um coverage arrastado pra fora do grupo volta pra baixo do pai (continua coverage — desvincular
 *  é uma ação explícita). Roda igual no cliente (resultado otimista do arraste) e no servidor
 *  (fonte da verdade), pra tela e banco nunca discordarem.
 *
 *  Defensivo com dado inconsistente: coverage cujo pai não existe mais na lista, ou cujo pai também
 *  é coverage (a API barra os dois, mas a ordem nunca pode perder plano por causa disso), é tratado
 *  como plano solto. */
export function normalizeShotOrder<T extends ShotHierarchyInput>(ordered: T[]): T[] {
  const ids = new Set(ordered.map((s) => s.id));
  const topLevelIds = new Set(
    ordered.filter((s) => !s.planoPaiId || !ids.has(s.planoPaiId)).map((s) => s.id)
  );

  const topLevel: T[] = [];
  const childrenByParent = new Map<string, T[]>();
  for (const shot of ordered) {
    if (shot.planoPaiId && topLevelIds.has(shot.planoPaiId)) {
      const list = childrenByParent.get(shot.planoPaiId) ?? [];
      list.push(shot);
      childrenByParent.set(shot.planoPaiId, list);
    } else {
      topLevel.push(shot);
    }
  }

  return topLevel.flatMap((parent) => [parent, ...(childrenByParent.get(parent.id) ?? [])]);
}

/** Próximo número livre da cena: maior número inteiro já usado + 1 (o "6" de "6A" também conta).
 *  Nunca reaproveita um buraco — se o plano 3 foi apagado, "3" pode já estar em claquete ou na
 *  folha da câmera; reaproveitar faria dois planos diferentes responderem pelo mesmo número. */
export function nextFreeShotNumero(numeros: string[]): string {
  let max = 0;
  for (const numero of numeros) {
    const match = /^(\d+)/.exec(numero.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

function letterSuffix(index: number): string {
  // 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB...
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Número de um plano ao virar coverage: número do pai + a primeira letra ainda não usada por
 *  NENHUM plano da cena (não só pelos irmãos — se alguém tiver digitado "6A" num plano solto, o
 *  coverage de 6 vira 6B, nunca um segundo 6A). */
export function coverageShotNumero(parentNumero: string, numerosDaCena: string[]): string {
  const taken = new Set(numerosDaCena.map((n) => n.trim().toUpperCase()));
  for (let i = 0; ; i++) {
    const candidate = `${parentNumero}${letterSuffix(i)}`;
    if (!taken.has(candidate.toUpperCase())) return candidate;
  }
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
