/**
 * Lançamento do realizado: o que de fato aconteceu na diária, digitado DEPOIS, a partir das
 * anotações da AD. O app é ferramenta de pré-diária — no set a equipe usa o PDF impresso, ninguém
 * fica apontando hora na tela.
 *
 * Puro, sem prisma: a mesma regra decide o status na rota (servidor) e na prévia da tela.
 *
 * Duas regras que vêm da rodada do bug crítico e continuam valendo: campo em branco FICA em branco
 * (nunca se preenche realizado com o previsto), e só esta tela e o Modo Set escrevem em
 * horaInicioReal/horaFimReal — planejamento nunca reescreve execução.
 */
import { formatTempoEstimado } from "@/lib/paginas";
import { formatHHh, timeToMinutes } from "@/lib/schedule";

export type StatusExecucao = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "ADIADA";

/** O que a AD digitou numa linha. `naoRealizada` = a cena não foi filmada; não inventa horário. */
export type LancamentoLinha = {
  horaInicioReal: string | null;
  horaFimReal: string | null;
  naoRealizada?: boolean;
};

/** Aceita o jeito que a AD escreve hora no caderno: "11:00", "1100", "11h00", "11h", "9:05".
 *  "" = apagar (volta a branco). `undefined` = não é hora — a tela recusa e não grava nada. */
export function parseHoraDigitada(texto: string): string | null | undefined {
  const limpo = texto.trim().toLowerCase().replace(/\s/g, "");
  if (limpo === "") return null;
  const m = limpo.match(/^(\d{1,2})(?::|h)?(\d{2})?h?$/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Duração entre duas horas do relógio. Fim menor que início é diária que virou a noite (chamada
 *  22h, fim 3h), não erro de digitação — some 24h em vez de recusar. */
export function duracaoRealizadaMin(inicio: string | null, fim: string | null): number | null {
  if (!inicio || !fim) return null;
  const diff = timeToMinutes(fim) - timeToMinutes(inicio);
  return diff >= 0 ? diff : diff + 1440;
}

/** Status que o lançamento implica. Lançar de novo corrige, inclusive pra trás: apagar as duas
 *  horas devolve a linha pra PENDENTE (o lançamento foi desfeito), não deixa uma cena "concluída"
 *  sem hora nenhuma. */
export function statusDoLancamento(linha: LancamentoLinha): StatusExecucao {
  if (linha.naoRealizada) return "ADIADA";
  if (linha.horaInicioReal && linha.horaFimReal) return "CONCLUIDA";
  if (linha.horaInicioReal || linha.horaFimReal) return "EM_ANDAMENTO";
  return "PENDENTE";
}

/** Não realizada não guarda horário: marcar a cena como não filmada apaga o que estiver lá. */
export function horasDoLancamento(linha: LancamentoLinha): { horaInicioReal: string | null; horaFimReal: string | null } {
  if (linha.naoRealizada) return { horaInicioReal: null, horaFimReal: null };
  return { horaInicioReal: linha.horaInicioReal, horaFimReal: linha.horaFimReal };
}

export type LinhaComparada = {
  rotulo: string;
  /** Janela prevista (prep + Rod da cena, ou a duração do bloco) — null sem horário calculado. */
  previstoMin: number | null;
  realizadoMin: number | null;
  /** realizado − previsto: positivo passou do previsto. null quando falta um dos dois. */
  desvioMin: number | null;
  naoRealizada: boolean;
};

export function compararLinha(entrada: {
  rotulo: string;
  previstoMin: number | null;
  horaInicioReal: string | null;
  horaFimReal: string | null;
  naoRealizada?: boolean;
}): LinhaComparada {
  const realizadoMin = duracaoRealizadaMin(entrada.horaInicioReal, entrada.horaFimReal);
  return {
    rotulo: entrada.rotulo,
    previstoMin: entrada.previstoMin,
    realizadoMin,
    desvioMin: entrada.previstoMin != null && realizadoMin != null ? realizadoMin - entrada.previstoMin : null,
    naoRealizada: Boolean(entrada.naoRealizada),
  };
}

export type TotalDoDia = {
  /** Quantas linhas entraram na conta: só as que têm realizado lançado. */
  lancadas: number;
  previstoMin: number;
  realizadoMin: number;
  desvioMin: number;
};

/** Total do dia só com o que foi lançado — somar o previsto de cena não lançada contra um realizado
 *  que não existe daria um "adiantamento" falso. */
export function totalDoDia(linhas: LinhaComparada[]): TotalDoDia {
  const comRealizado = linhas.filter((l) => l.realizadoMin != null && l.previstoMin != null);
  const previstoMin = comRealizado.reduce((s, l) => s + l.previstoMin!, 0);
  const realizadoMin = comRealizado.reduce((s, l) => s + l.realizadoMin!, 0);
  return { lancadas: comRealizado.length, previstoMin, realizadoMin, desvioMin: realizadoMin - previstoMin };
}

/** "+30min", "-25min", "no previsto". Hífen comum de propósito: o sinal de menos (−) não existe na
 *  Helvetica e sai como lixo nos PDFs (ver verify:pdf). */
export function formatDesvio(desvioMin: number): string {
  if (desvioMin === 0) return "no previsto";
  return `${desvioMin > 0 ? "+" : "-"}${formatTempoEstimado(Math.abs(desvioMin))}`;
}

/** "Cena 18 · previsto 2h50 · realizado 3h20 · +30min" — mesma frase na tela e no relatório. */
export function fraseComparacao(l: LinhaComparada): string {
  if (l.naoRealizada) return `${l.rotulo} · não realizada`;
  if (l.realizadoMin == null) return `${l.rotulo} · sem realizado lançado`;
  const previsto = l.previstoMin != null ? `previsto ${formatTempoEstimado(l.previstoMin)} · ` : "sem previsto · ";
  const desvio = l.desvioMin != null ? ` · ${formatDesvio(l.desvioMin)}` : "";
  return `${l.rotulo} · ${previsto}realizado ${formatTempoEstimado(l.realizadoMin)}${desvio}`;
}

/** "Diária · previsto 8h20 · realizado 9h05 · +45min" (ou o aviso de que não há o que comparar). */
export function fraseTotalDoDia(t: TotalDoDia): string {
  if (t.lancadas === 0) return "Diária · nenhum realizado lançado ainda";
  return `Diária · previsto ${formatTempoEstimado(t.previstoMin)} · realizado ${formatTempoEstimado(
    t.realizadoMin
  )} · ${formatDesvio(t.desvioMin)}`;
}

/** Duração pra célula de tabela: "2h50", ou travessão quando não há o que mostrar. */
export function formatTempoEstimadoOuTraco(min: number | null): string {
  return min == null ? "—" : formatTempoEstimado(min);
}

/** "11h00 às 13h50" pra coluna de previsto/realizado; "—" quando falta. */
export function faixaHoraria(inicio: string | null, fim: string | null): string {
  if (!inicio && !fim) return "—";
  if (inicio && fim) return `${formatHHh(inicio)} às ${formatHHh(fim)}`;
  return `${inicio ? formatHHh(inicio) : "—"} às ${fim ? formatHHh(fim) : "—"}`;
}
