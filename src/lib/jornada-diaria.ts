/**
 * Modo simplificado da diária: orçamento de tempo. A AD define o teto primeiro ("12h de jornada" ou
 * "acaba às 18h"), distribui prep e Rod por cena, e o sistema diz se estourou. Sem plano nenhum.
 *
 * Puro, sem prisma — roda no navegador pra recalcular a lista a cada número digitado.
 *
 * NÃO é um cronograma novo: é a mesma timeline do dia (intercalar/scheduleDoBloco, de day-timeline)
 * com o mesmo corte de almoço de recalculateDayBlocks (src/lib/shootday-blocks.ts), só que em
 * minutos absolutos pra passar da meia-noite sem dar a volta no relógio. `verify:jornada` confere que
 * os horários batem com os que o servidor grava e a OD imprime.
 *
 * O teto só AVISA (avaliarTempoAlvo, de tempo-alvo.ts — o mesmo cálculo da duração alvo da cena, um
 * nível acima). Nunca bloqueia, nunca redistribui prep/Rod: AD estoura jornada de propósito e
 * negocia depois.
 */
import { intercalar, scheduleDoBloco, type BlocoDeTempo } from "@/lib/day-timeline";
import { formatTempoEstimado } from "@/lib/paginas";
import { formatHHh, minutesToTime, suggestAlmocoIndex, timeToMinutes, type JornadaConfig } from "@/lib/schedule";
import { avaliarTempoAlvo, type AvaliacaoTempoAlvo } from "@/lib/tempo-alvo";

/** Faixa aceita pro teto em minutos: de 1h a 24h. */
export const JORNADA_MIN_MIN = 60;
export const JORNADA_MAX_MIN = 24 * 60;
/** Reserva: margem do DIA que a AD guarda pra atraso. Máximo de 8h — acima disso não é margem, é
 *  outro planejamento. */
export const RESERVA_MAX_MIN = 8 * 60;

export type TetoDiaria = { jornadaMin: number | null; horaFimAlvo: string | null };

/** Cena (ou parte) já com prep/Rod EFETIVOS — resolveEffectivePrepMin/resolveEffectiveRodMin
 *  aplicados por quem chama, igual à OD. `bloco` é o gravado: manhã ou tarde do almoço. */
export type CenaDaJornada = { ordem: number; bloco: "MANHA" | "TARDE"; prepMin: number; rodMin: number };

/** `inicio` em minutos desde 00h00 do dia da diária — passa de 1440 em diária que vira a noite.
 *  null quando não há chamada geral (sem ela não existe horário, só duração). */
export type LinhaJornada<C> =
  | { kind: "chamada"; inicio: number | null; duracaoMin: number }
  | { kind: "cena"; inicio: number | null; duracaoMin: number; cena: C }
  | { kind: "bloco"; inicio: number | null; duracaoMin: number; bloco: BlocoDeTempo }
  | { kind: "almoco"; inicio: number | null; duracaoMin: number }
  | { kind: "desprod"; inicio: number | null; duracaoMin: 0 };

export type JornadaMontada<C> = {
  linhas: LinhaJornada<C>[];
  chamadaMin: number | null;
  /** Da chamada geral até a desprodução: preparação inicial + itens + almoço. */
  totalMin: number;
  /** Fim previsto (= início da desprodução), ou null sem chamada. */
  fimMin: number | null;
};

/** Monta a lista de horários do dia. O corte do almoço segue recalculateDayBlocks: diária que nunca
 *  foi dividida (tudo MANHA) ganha o corte sugerido pelo limite de almoço do projeto — que o servidor
 *  grava no primeiro save —; diária já dividida respeita manhã/tarde gravados. */
export function montarJornada<C extends CenaDaJornada>({
  chamadaGeral,
  config,
  cenas,
  blocos,
}: {
  chamadaGeral: string | null;
  config: JornadaConfig;
  cenas: C[];
  blocos: BlocoDeTempo[];
}): JornadaMontada<C> {
  const todos = intercalar(cenas, blocos);
  const ladoDo = (i: (typeof todos)[number]) => (i.tipo === "cena" ? i.cena.bloco : i.bloco.bloco);
  const itemDo = (i: (typeof todos)[number]) =>
    i.tipo === "cena" ? { prepMin: i.cena.prepMin, rodMin: i.cena.rodMin } : scheduleDoBloco(i.bloco);

  let manha = todos.filter((i) => ladoDo(i) === "MANHA");
  let tarde = todos.filter((i) => ladoDo(i) === "TARDE");
  const nuncaDividida = cenas.length > 0 && todos.every((i) => ladoDo(i) === "MANHA");
  if (nuncaDividida) {
    const inicioManha = chamadaGeral
      ? minutesToTime(timeToMinutes(chamadaGeral) + config.preparacaoInicialMin)
      : null;
    const corte = suggestAlmocoIndex(chamadaGeral, inicioManha, todos.map(itemDo), config.limiteAlmocoMin);
    manha = todos.slice(0, corte);
    tarde = todos.slice(corte);
  }

  const chamadaMin = chamadaGeral ? timeToMinutes(chamadaGeral) : null;
  let decorrido = 0;
  const em = () => (chamadaMin === null ? null : chamadaMin + decorrido);
  const linhas: LinhaJornada<C>[] = [];

  const empurrar = (i: (typeof todos)[number]) => {
    const { prepMin, rodMin } = itemDo(i);
    const duracaoMin = prepMin + rodMin;
    linhas.push(
      i.tipo === "cena"
        ? { kind: "cena", inicio: em(), duracaoMin, cena: i.cena }
        : { kind: "bloco", inicio: em(), duracaoMin, bloco: i.bloco }
    );
    decorrido += duracaoMin;
  };

  if (todos.length > 0) {
    linhas.push({ kind: "chamada", inicio: em(), duracaoMin: config.preparacaoInicialMin });
    decorrido += config.preparacaoInicialMin;
    manha.forEach(empurrar);
    // Mesma regra da OD e do Hora a Hora: diária com qualquer item tem almoço (computeDerivedBlockTimes
    // sempre deriva um), mesmo que a tarde esteja vazia.
    linhas.push({ kind: "almoco", inicio: em(), duracaoMin: config.duracaoAlmocoMin });
    decorrido += config.duracaoAlmocoMin;
    tarde.forEach(empurrar);
    linhas.push({ kind: "desprod", inicio: em(), duracaoMin: 0 });
  }

  return { linhas, chamadaMin, totalMin: decorrido, fimMin: todos.length > 0 ? em() : null };
}

/** Jornada em minutos a partir do teto. Hora de fim precisa da chamada; fim antes (ou igual) da
 *  chamada é diária que atravessa a meia-noite (chamada 18h, fim 6h = 12h). */
export function jornadaDoTeto(teto: TetoDiaria, chamadaGeral: string | null): number | null {
  if (teto.jornadaMin != null) return teto.jornadaMin;
  if (teto.horaFimAlvo == null || !chamadaGeral) return null;
  const diff = timeToMinutes(teto.horaFimAlvo) - timeToMinutes(chamadaGeral);
  return diff > 0 ? diff : diff + 1440;
}

export type AvaliacaoJornada =
  | { estado: "SEM_TETO" }
  /** Hora de fim definida, mas sem chamada não dá pra saber quanto tempo isso é. */
  | { estado: "TETO_SEM_CHAMADA"; horaFimAlvo: string }
  | {
      estado: "AVALIADA";
      avaliacao: AvaliacaoTempoAlvo;
      /** Limite no relógio (chamada + jornada) e fim previsto — null sem chamada (teto em jornada). */
      limiteMin: number | null;
      fimMin: number | null;
      /** Margem da AD já considerada na conta. 0 = sem reserva. NUNCA vai pra documento. */
      reservaMin: number;
      /** Fim previsto + reserva: o segundo horário, só das telas de planejamento da AD. */
      fimComReservaMin: number | null;
    };

/** `reservaMin` entra na SOMA: a pergunta da AD é "cabe, já guardando uma hora de margem?". */
export function avaliarJornada(
  teto: TetoDiaria,
  chamadaGeral: string | null,
  montada: Pick<JornadaMontada<unknown>, "totalMin" | "fimMin" | "chamadaMin">,
  reservaMin: number | null = 0
): AvaliacaoJornada {
  if (teto.jornadaMin == null && teto.horaFimAlvo == null) return { estado: "SEM_TETO" };
  const alvoMin = jornadaDoTeto(teto, chamadaGeral);
  if (alvoMin === null) return { estado: "TETO_SEM_CHAMADA", horaFimAlvo: teto.horaFimAlvo! };
  const reserva = reservaMin ?? 0;
  return {
    estado: "AVALIADA",
    avaliacao: avaliarTempoAlvo({ alvoMin, somaMin: montada.totalMin + reserva, partes: [] }),
    limiteMin: montada.chamadaMin === null ? null : montada.chamadaMin + alvoMin,
    fimMin: montada.fimMin,
    reservaMin: reserva,
    fimComReservaMin: montada.fimMin === null ? null : montada.fimMin + reserva,
  };
}

/** "19h40", e "1h30 (+1)" depois da meia-noite. */
export function formatHoraDoDia(minDoDia: number): string {
  const hora = formatHHh(minutesToTime(minDoDia));
  const dias = Math.floor(minDoDia / 1440);
  return dias > 0 ? `${hora} (+${dias})` : hora;
}

/** Texto do aviso. Estourou: "Excedeu em 40min. Fim previsto 19h40, limite 19h00." + os cortáveis
 *  (se a diária tiver planos decupados) + o que fazer. Coube: "Sobram 25min na jornada." Sem teto:
 *  nada — a lista de horários basta. */
export function mensagemJornada(
  av: AvaliacaoJornada,
  { cortaveisMin }: { cortaveisMin: number }
): { tom: "estourou" | "coube" | "info"; linhas: string[] } | null {
  if (av.estado === "SEM_TETO") return null;
  if (av.estado === "TETO_SEM_CHAMADA") {
    return {
      tom: "info",
      linhas: [`Defina a chamada geral pra comparar com o fim às ${formatHHh(av.horaFimAlvo)}.`],
    };
  }
  const { avaliacao, limiteMin, fimMin, reservaMin, fimComReservaMin } = av;
  // "Com a reserva de 1h, ..." — a margem é da AD e aparece só aqui; nenhum documento a conhece.
  const comReserva = reservaMin > 0 ? `Com a reserva de ${formatTempoEstimado(reservaMin)}, ` : "";
  if (!avaliacao.estourou) {
    return {
      tom: "coube",
      linhas: [`${comReserva}${comReserva ? "sobram" : "Sobram"} ${formatTempoEstimado(avaliacao.saldoMin)} na jornada.`],
    };
  }
  const excesso = formatTempoEstimado(-avaliacao.saldoMin);
  const margem = reservaMin > 0 && fimComReservaMin !== null ? `, com reserva ${formatHoraDoDia(fimComReservaMin)}` : "";
  const onde =
    limiteMin !== null && fimMin !== null
      ? `Fim previsto ${formatHoraDoDia(fimMin)}${margem}, limite ${formatHoraDoDia(limiteMin)}.`
      : `A diária soma ${formatTempoEstimado(avaliacao.somaMin)} e a jornada é de ${formatTempoEstimado(avaliacao.alvoMin)}.`;
  return {
    tom: "estourou",
    linhas: [
      `${comReserva}${comReserva ? "excede" : "Excedeu"} em ${excesso}. ${onde}`,
      ...(cortaveisMin > 0 ? [`Há ${formatTempoEstimado(cortaveisMin)} em planos cortáveis.`] : []),
      `Corte ${excesso} de prep ou rodagem, ou empurre uma cena pra outra diária.`,
    ],
  };
}
