/** Aritmética de horários "HH:mm" para o cálculo sequencial de Prep/Rod do stripboard. */

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Formata "HH:mm" no padrão "11h15" usado nas tiras do stripboard. */
export function formatHHh(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${Number(h)}h${m}`;
}

export function formatHHhOrDash(hhmm: string | null | undefined): string {
  return hhmm ? formatHHh(hhmm) : "—";
}

export type ScheduleItem = { prepMin: number; rodMin: number };
export type ComputedSchedule = {
  prepStart: string;
  prepEnd: string;
  rodStart: string;
  rodEnd: string;
};

export const DEFAULT_PREP_MIN = 15;
// Exclusivo do auto-preenchimento (arrastar/distribuir) — nunca usado na resolução passiva de horário.
export const DEFAULT_ROD_MIN = 30;
export const MIN_ROD_MIN = 5;

/** Prep=0 gravado é intencional ("sem prep necessário", ex.: cenas consecutivas no mesmo set) — só
 *  `null` (nunca preenchido) aciona o padrão de 15min. */
export function resolveEffectivePrepMin(prepMin: number | null): number {
  return prepMin ?? DEFAULT_PREP_MIN;
}

/** Rod nunca é legitimamente 0 (uma cena sempre leva algum tempo pra rodar) — null e 0 caem no
 *  tempoEstimadoMin da cena, com piso absoluto de MIN_ROD_MIN pra nunca calcular um bloco de duração zero. */
export function resolveEffectiveRodMin(rodMin: number | null, tempoEstimadoMin: number | null): number {
  const base = rodMin || tempoEstimadoMin || 0;
  return Math.max(base, MIN_ROD_MIN);
}

type LocatableScene = { set: string | null; locacao: string | null };

function locationKey(scene: LocatableScene): string | null {
  return scene.set ?? scene.locacao ?? null;
}

/** Dado ausente de qualquer um dos lados nunca conta como "mesma localização" — evita assumir 0min de
 *  prep por falta de informação. */
export function isSameLocation(a: LocatableScene, b: LocatableScene): boolean {
  const keyA = locationKey(a);
  const keyB = locationKey(b);
  return keyA !== null && keyA === keyB;
}

export function computeAutoFillRodMin(tempoEstimadoMin: number | null): number {
  return tempoEstimadoMin ?? DEFAULT_ROD_MIN;
}

/** `firstScenePrepMin` varia por contexto: 15 ao arrastar uma cena por vez do Boneyard, 90 ao
 *  distribuir tempos em lote no wizard (montagem inicial do bloco). */
export function computeAutoFillPrepMin(
  previous: LocatableScene | undefined,
  current: LocatableScene,
  firstScenePrepMin: number
): number {
  if (!previous) return firstScenePrepMin;
  return isSameLocation(previous, current) ? 0 : DEFAULT_PREP_MIN;
}

/** Calcula prep/rod em sequência para os itens de um bloco, a partir do horário de início do bloco. */
export function computeBlockSchedule(
  startTime: string | null | undefined,
  items: ScheduleItem[]
): (ComputedSchedule | null)[] {
  if (!startTime) return items.map(() => null);

  let cursor = timeToMinutes(startTime);
  return items.map((item) => {
    const prepStart = cursor;
    const prepEnd = prepStart + item.prepMin;
    const rodStart = prepEnd;
    const rodEnd = rodStart + item.rodMin;
    cursor = rodEnd;
    return {
      prepStart: minutesToTime(prepStart),
      prepEnd: minutesToTime(prepEnd),
      rodStart: minutesToTime(rodStart),
      rodEnd: minutesToTime(rodEnd),
    };
  });
}
