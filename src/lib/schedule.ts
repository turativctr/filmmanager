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

/** Formata uma DURAÇÃO em minutos (não um horário) no mesmo padrão "5h45" de formatHHh — usado nas
 *  mensagens de validação do almoço ("Almoço 5h45 após a chamada"), onde o número representa tempo
 *  decorrido desde a chamada geral, não um horário do relógio. */
export function formatDurationHHh(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export type JornadaConfig = {
  limiteAlmocoMin: number;
  duracaoAlmocoMin: number;
  preparacaoInicialMin: number;
};

export type DerivedBlockTimes = {
  blocoManhaInicio: string | null;
  almocoInicio: string | null;
  almocoFim: string | null;
  blocoTardeInicio: string | null;
};

/** Deriva os horários de bloco/almoço de uma diária a partir da chamada geral, da Jornada configurada
 *  no projeto e do tempo acumulado das cenas da manhã (bloco não é definido, é consequência da posição
 *  do marcador de almoço no Stripboard — ver recalculateDayBlocks em src/lib/shootday-blocks.ts, que
 *  chama esta função depois de qualquer reorder/edição). Sem chamada geral não há nenhum horário
 *  calculável — tudo fica null, como já acontecia quando os campos eram editados manualmente. */
export function computeDerivedBlockTimes(
  chamadaGeral: string | null,
  manhaItems: ScheduleItem[],
  config: JornadaConfig
): DerivedBlockTimes {
  if (!chamadaGeral) {
    return { blocoManhaInicio: null, almocoInicio: null, almocoFim: null, blocoTardeInicio: null };
  }

  const blocoManhaInicio = minutesToTime(timeToMinutes(chamadaGeral) + config.preparacaoInicialMin);
  const manhaSchedule = computeBlockSchedule(blocoManhaInicio, manhaItems);
  const lastManha = manhaSchedule[manhaSchedule.length - 1];
  const almocoInicioMin = lastManha ? timeToMinutes(lastManha.rodEnd) : timeToMinutes(blocoManhaInicio);
  const almocoFimMin = almocoInicioMin + config.duracaoAlmocoMin;

  return {
    blocoManhaInicio,
    almocoInicio: minutesToTime(almocoInicioMin),
    almocoFim: minutesToTime(almocoFimMin),
    blocoTardeInicio: minutesToTime(almocoFimMin),
  };
}

/** Sugere onde posicionar o marcador de almoço quando a diária ainda nunca foi dividida manualmente
 *  (todas as cenas em bloco MANHA) — o último corte de cena antes que `limiteAlmocoMin` (contado a
 *  partir da chamada geral) seria excedido. Usado tanto por recalculateDayBlocks (pra persistir o
 *  corte de fato, em src/lib/shootday-blocks.ts) quanto por getStripboardBoard (pra exibir a mesma
 *  sugestão antes de qualquer gravação, no primeiro carregamento da página). */
export function suggestAlmocoIndex(
  chamadaGeral: string | null,
  blocoManhaInicio: string | null,
  items: ScheduleItem[],
  limiteAlmocoMin: number
): number {
  if (!chamadaGeral || !blocoManhaInicio) return items.length;

  const deadline = timeToMinutes(chamadaGeral) + limiteAlmocoMin;
  const schedule = computeBlockSchedule(blocoManhaInicio, items);

  for (let i = 0; i < schedule.length; i++) {
    const entry = schedule[i];
    if (entry && timeToMinutes(entry.rodEnd) > deadline) return i;
  }
  return items.length;
}

export type AlmocoValidationStatus = "ok" | "perto" | "acima";

export type AlmocoValidation = {
  status: AlmocoValidationStatus;
  /** Minutos decorridos entre a chamada geral e o início do almoço — null quando não há dado suficiente. */
  minutosDesdeChamada: number | null;
  /** Mensagem pronta pra exibir no marcador, já no formato "Almoço 5h45 após a chamada — perto do limite" — null quando status é "ok" (sem aviso). */
  mensagem: string | null;
};

/** Valida a distância entre a chamada geral e o início do almoço contra o limite configurado do
 *  projeto — nunca bloqueia a ação (o AD pode ter motivo pra estourar; o sistema avisa e ele decide),
 *  só classifica o marcador em âmbar/vermelho pra UI. Faixa âmbar = últimos 30min antes do limite. */
export function validateAlmocoTiming(
  chamadaGeral: string | null,
  almocoInicio: string | null,
  limiteAlmocoMin: number
): AlmocoValidation {
  if (!chamadaGeral || !almocoInicio) {
    return { status: "ok", minutosDesdeChamada: null, mensagem: null };
  }

  const minutosDesdeChamada = timeToMinutes(almocoInicio) - timeToMinutes(chamadaGeral);
  const decorrido = formatDurationHHh(Math.max(minutosDesdeChamada, 0));

  if (minutosDesdeChamada > limiteAlmocoMin) {
    return {
      status: "acima",
      minutosDesdeChamada,
      mensagem: `Almoço ${decorrido} após a chamada — acima do limite`,
    };
  }
  if (minutosDesdeChamada > limiteAlmocoMin - 30) {
    return {
      status: "perto",
      minutosDesdeChamada,
      mensagem: `Almoço ${decorrido} após a chamada — perto do limite`,
    };
  }
  return { status: "ok", minutosDesdeChamada, mensagem: null };
}
