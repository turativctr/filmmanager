/** "Tempo reverso": a AD define quanto tempo um bloco tem (hoje a cena, via Scene.duracaoAlvoMin;
 *  depois a diária inteira, com teto de jornada) e o sistema compara com o que as partes somam.
 *
 *  Genérico de propósito — nada aqui sabe o que é cena, plano ou diária. Quem chama traduz as
 *  partes (planos da cena, cenas da diária) e escolhe o substantivo das mensagens. Sem dependência
 *  de prisma: roda no navegador.
 *
 *  Nunca bloqueia nada e nunca escreve em campo nenhum: só descreve. AD estoura tempo de propósito
 *  e negocia depois; a média é sugestão EXIBIDA, jamais redistribuída nos tempos que a AD digitou. */

import { formatTempoEstimado } from "@/lib/paginas";

export type ParteDoTempo = {
  id: string;
  /** Como a parte aparece no aviso ("Plano 4"). */
  rotulo: string;
  /** Tempo fixo de preparação da parte — só usado no aviso "setup não cabe na média". */
  setupMin?: number;
};

export type AvaliacaoTempoAlvo = {
  alvoMin: number;
  quantidade: number;
  /** alvo ÷ quantidade, em segundos; null sem partes (não dá pra dividir por zero). */
  mediaSeg: number | null;
  somaMin: number;
  /** alvo − soma: positivo = sobra, negativo = estouro. */
  saldoMin: number;
  estourou: boolean;
  /** Partes cujo setup SOZINHO já passa da média — vale pra qualquer parte, preenchida ou não. */
  setupsAcimaDaMedia: { id: string; rotulo: string; setupMin: number }[];
};

export function avaliarTempoAlvo({
  alvoMin,
  somaMin,
  partes,
}: {
  alvoMin: number;
  /** Soma já calculada por quem chama — pra cena, a mesma soma que viraria o Rod sem alvo
   *  (computeSceneShotTotals: planos + resets, sem descartados), pra que "planos somam Xmin" seja
   *  o mesmo número nos dois modos. */
  somaMin: number;
  partes: ParteDoTempo[];
}): AvaliacaoTempoAlvo {
  const quantidade = partes.length;
  const mediaSeg = quantidade > 0 ? (alvoMin * 60) / quantidade : null;
  const saldoMin = alvoMin - somaMin;

  const setupsAcimaDaMedia =
    mediaSeg === null
      ? []
      : partes
          .filter((p) => (p.setupMin ?? 0) * 60 > mediaSeg)
          .map((p) => ({ id: p.id, rotulo: p.rotulo, setupMin: p.setupMin ?? 0 }));

  return {
    alvoMin,
    quantidade,
    mediaSeg,
    somaMin,
    saldoMin,
    estourou: saldoMin < 0,
    setupsAcimaDaMedia,
  };
}

/** Duração curta legível no set: "3min20", "3min", "40s". Nunca decimal ("3,3min" não se lê
 *  batendo o olho numa prancheta). Acima de uma hora cai pro formato h/min do resto do app. */
export function formatDuracaoCurta(totalSeg: number): string {
  const seg = Math.max(0, Math.round(totalSeg));
  const min = Math.floor(seg / 60);
  const resto = seg % 60;
  if (min >= 60) return formatTempoEstimado(Math.round(seg / 60));
  if (min === 0) return `${resto}s`;
  if (resto === 0) return `${min}min`;
  return `${min}min${String(resto).padStart(2, "0")}`;
}

/** "10min para 3 planos · ~3min20 por plano". `singular`/`plural` são o nome da parte. */
export function mensagemMedia(av: AvaliacaoTempoAlvo, singular: string, plural: string): string {
  const alvo = formatTempoEstimado(av.alvoMin);
  if (av.mediaSeg === null) return `${alvo} · nenhum ${singular} ainda`;
  const nome = av.quantidade === 1 ? singular : plural;
  return `${alvo} para ${av.quantidade} ${nome} · ~${formatDuracaoCurta(av.mediaSeg)} por ${singular}`;
}

/** "Estourou em 12min. A cena tem 10min e os planos somam 22min." / "Sobram 3min."
 *  `sujeito` e `partesComArtigo` fazem a frase servir pra cena ("A cena", "os planos") e depois
 *  pra diária ("A diária", "as cenas"). */
export function mensagemSaldo(av: AvaliacaoTempoAlvo, sujeito: string, partesComArtigo: string): string {
  if (av.estourou) {
    return (
      `Estourou em ${formatTempoEstimado(-av.saldoMin)}. ` +
      `${sujeito} tem ${formatTempoEstimado(av.alvoMin)} e ${partesComArtigo} somam ${formatTempoEstimado(av.somaMin)}.`
    );
  }
  return `Sobram ${av.saldoMin === 0 ? "0min" : formatTempoEstimado(av.saldoMin)}.`;
}

/** "setup de 7min não cabe em ~3min20" */
export function mensagemSetupAcimaDaMedia(setupMin: number, mediaSeg: number): string {
  return `setup de ${formatTempoEstimado(setupMin)} não cabe em ~${formatDuracaoCurta(mediaSeg)}`;
}
