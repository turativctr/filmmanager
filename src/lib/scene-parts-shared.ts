/**
 * Divisão da mesma cena entre diárias (ScenePart) — regras puras, sem prisma, usadas pela API, pelo
 * stripboard, pela OD e pelo Modo Set.
 *
 * Cena sem divisão não tem parte nenhuma: tudo aqui trata `partes.length === 0` como "cena inteira",
 * pra quem chama não precisar de um ramo especial.
 */
import { computeSceneShotTotals } from "@/lib/shots-shared";
import { MIN_ROD_MIN } from "@/lib/schedule";

/** Oitavos da cena a partir de Scene.paginas (decimal: 0.75 = 6/8). */
export function paginasParaOitavos(paginas: number | string | { toString(): string }): number {
  return Math.round(Number(paginas.toString()) * 8);
}

export type ParteInput = { rotulo: string; oitavos: number };

export type ProblemaDivisao =
  | { tipo: "POUCAS_PARTES" }
  | { tipo: "ROTULO_VAZIO"; indice: number }
  | { tipo: "OITAVOS_INVALIDOS"; indice: number }
  | { tipo: "SOMA_NAO_FECHA"; somaOitavos: number; oitavosCena: number };

/** Valida uma divisão ANTES de gravar. A soma tem que fechar exatamente: 6/8 vira 5/8 + 1/8 ou
 *  3/8 + 3/8, nunca 6/8 + 6/8 — oitavo contado duas vezes infla o total do projeto e o progresso. */
export function validarDivisao(oitavosCena: number, partes: ParteInput[]): ProblemaDivisao[] {
  const problemas: ProblemaDivisao[] = [];
  if (partes.length < 2) problemas.push({ tipo: "POUCAS_PARTES" });
  partes.forEach((p, indice) => {
    if (p.rotulo.trim() === "") problemas.push({ tipo: "ROTULO_VAZIO", indice });
    if (!Number.isInteger(p.oitavos) || p.oitavos < 0) problemas.push({ tipo: "OITAVOS_INVALIDOS", indice });
  });
  const somaOitavos = partes.reduce((s, p) => s + p.oitavos, 0);
  if (somaOitavos !== oitavosCena) problemas.push({ tipo: "SOMA_NAO_FECHA", somaOitavos, oitavosCena });
  return problemas;
}

export function mensagemProblemaDivisao(p: ProblemaDivisao, partes: ParteInput[]): string {
  switch (p.tipo) {
    case "POUCAS_PARTES":
      return "Divisão precisa de pelo menos duas partes. Pra voltar à cena inteira, desfaça a divisão.";
    case "ROTULO_VAZIO":
      return `A parte ${p.indice + 1} está sem rótulo.`;
    case "OITAVOS_INVALIDOS":
      return `Oitavos inválidos em "${partes[p.indice]?.rotulo || `parte ${p.indice + 1}`}" — use um número inteiro, 0 ou mais.`;
    case "SOMA_NAO_FECHA":
      return `As partes somam ${formatOitavos(p.somaOitavos)} e a cena tem ${formatOitavos(p.oitavosCena)}. A soma tem que ser igual — oitavo não pode contar duas vezes.`;
  }
}

/** "0", "6/8", "1 2/8" — mesmo formato de formatPaginas, a partir de oitavos inteiros. */
export function formatOitavos(oitavos: number): string {
  const inteiro = Math.floor(oitavos / 8);
  const resto = oitavos % 8;
  if (inteiro === 0 && resto === 0) return "0";
  if (resto === 0) return `${inteiro}`;
  if (inteiro === 0) return `${resto}/8`;
  return `${inteiro} ${resto}/8`;
}

/** Divisão gravada que deixou de fechar porque as páginas da cena mudaram depois (edição manual ou
 *  reimportação). Não trava nada — só avisa. Cena sem divisão sempre "fecha". */
export function divisaoNaoFecha(oitavosCena: number, partes: { oitavos: number }[]): boolean {
  if (partes.length === 0) return false;
  return partes.reduce((s, p) => s + p.oitavos, 0) !== oitavosCena;
}

export function mensagemDivisaoNaoFecha(oitavosCena: number, partes: { oitavos: number }[]): string {
  const soma = partes.reduce((s, p) => s + p.oitavos, 0);
  return `Divisão não fecha: as partes somam ${formatOitavos(soma)} e a cena tem ${formatOitavos(oitavosCena)}. Ajuste os oitavos das partes.`;
}

/** "19 · Voice off" — número da cena com o rótulo da parte. Nunca só "19" pra uma parte: a equipe
 *  montaria o set de imagem achando que vai filmar. */
export function numeroComParte(numero: string, parte: { rotulo: string } | null | undefined): string {
  return parte ? `${numero} · ${parte.rotulo}` : numero;
}

/** Páginas que uma linha agendada representa: os oitavos da parte, ou a cena inteira. */
export function paginasDaEntrada(paginasCena: number, parte: { oitavos: number } | null | undefined): number {
  return parte ? parte.oitavos / 8 : paginasCena;
}

/** Tempo estimado que uma linha agendada representa — o da cena, proporcional aos oitavos da parte.
 *  É o fallback do Rod no cronograma (resolveEffectiveRodMin) quando a linha não tem Rod gravado;
 *  usar o da cena inteira faria uma parte de 1/8 ocupar a cena toda no horário. */
export function tempoEstimadoDaEntrada(
  tempoEstimadoCenaMin: number | null,
  oitavosCena: number,
  parte: { oitavos: number } | null | undefined
): number | null {
  if (!parte) return tempoEstimadoCenaMin;
  if (tempoEstimadoCenaMin == null || oitavosCena <= 0) return null;
  return Math.round((tempoEstimadoCenaMin * parte.oitavos) / oitavosCena);
}

/** Rótulo da origem do Rod de uma parte — mesmo padrão do "estimado pelos oitavos" da cena inteira:
 *  diz de onde o número vem, e o mínimo se apresenta como chute a ser definido. */
export function origemRodDaParte(fonte: FonteRodParte): string {
  switch (fonte) {
    case "PLANOS":
      return "planos atribuídos a ela";
    case "ESTIMADO_PROPORCIONAL":
      return "estimado pelos oitavos da parte";
    case "MINIMO":
      return "mínimo, sem planos e sem páginas — defina";
  }
}

export type OutraParte = { rotulo: string; numeroDia: number | null };

/** "voice off na diária 5" / "imagem sem diária" — o outro lado do vínculo, em minúscula porque
 *  vem depois do rótulo da parte atual: "Cena 19 · Imagem · voice off na diária 5". */
export function descreverOutrasPartes(outras: OutraParte[]): string {
  return outras
    .map((o) => `${o.rotulo.toLowerCase()} ${o.numeroDia != null ? `na diária ${o.numeroDia}` : "sem diária"}`)
    .join(" · ");
}

/** Linha completa do vínculo: "Cena 19 · Imagem · voice off na diária 5". */
export function vinculoDaParte(numero: string, parte: { rotulo: string }, outras: OutraParte[]): string {
  const resto = descreverOutrasPartes(outras);
  return `Cena ${numeroComParte(numero, parte)}${resto ? ` · ${resto}` : ""}`;
}

type PlanoParaRod = Parameters<typeof computeSceneShotTotals>[0][number] & { scenePartId: string | null };

/** MINIMO = nem planos nem oitavos que sustentem um número (ex.: voice off de 0 oitavos): o Rod cai
 *  no mínimo técnico, que é chute — a tela precisa dizer isso, senão parece um tempo real. */
export type FonteRodParte = "PLANOS" | "ESTIMADO_PROPORCIONAL" | "MINIMO";

/** Rod de uma parte (decisão A): soma dos planos ATRIBUÍDOS a ela; sem planos, o tempo estimado da
 *  cena proporcional aos oitavos da parte (mínimo de MIN_ROD_MIN — parte de 0 oitavos, como um voice
 *  off, ainda leva algum tempo). Plano sem parte não entra em nenhuma. A duração alvo da cena NÃO
 *  define o Rod de parte: numa cena dividida ela é só referência do total. */
export function resolveRodDaParte({
  parteId,
  oitavosParte,
  oitavosCena,
  tempoEstimadoCenaMin,
  planos,
}: {
  parteId: string;
  oitavosParte: number;
  oitavosCena: number;
  tempoEstimadoCenaMin: number | null;
  planos: PlanoParaRod[];
}): { rodMin: number; fonte: FonteRodParte } {
  const daParte = planos.filter((p) => p.scenePartId === parteId);
  if (daParte.length > 0) return { rodMin: computeSceneShotTotals(daParte).totalMin, fonte: "PLANOS" };
  const proporcional =
    oitavosCena > 0 && tempoEstimadoCenaMin ? Math.round((tempoEstimadoCenaMin * oitavosParte) / oitavosCena) : 0;
  if (proporcional < MIN_ROD_MIN) return { rodMin: MIN_ROD_MIN, fonte: "MINIMO" };
  return { rodMin: proporcional, fonte: "ESTIMADO_PROPORCIONAL" };
}

/** Minutos em planos sem parte numa cena dividida — não contam no Rod de parte nenhuma, então a AD
 *  precisa ver o número pra atribuir. Mesma regra de soma (descartados fora, resets dentro). */
export function minutosEmPlanosSemParte(planos: PlanoParaRod[]): number {
  return computeSceneShotTotals(planos.filter((p) => p.scenePartId === null)).totalMin;
}

/** Planos que aparecem numa parte: os atribuídos a ela e os sem parte (esses aparecem em todas). */
export function planosDaParte<T extends { scenePartId: string | null }>(planos: T[], parteId: string | null): T[] {
  if (parteId === null) return planos;
  return planos.filter((p) => p.scenePartId === parteId || p.scenePartId === null);
}

/** Cena dividida só está concluída quando TODAS as partes estão (decisão D). Parte sem diária conta
 *  como não concluída. Sem divisão, vale o status da única linha agendada. */
export function cenaConcluida(totalPartes: number, statusPorParte: string[]): boolean {
  if (totalPartes === 0) return statusPorParte.some((s) => s === "CONCLUIDA");
  return statusPorParte.filter((s) => s === "CONCLUIDA").length >= totalPartes;
}
