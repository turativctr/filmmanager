/**
 * De onde vem o tempo sugerido — e como dizer isso na tela.
 *
 * A AD abandonou a montagem da OD quando percebeu que o app sugeria tempo "sem base nenhuma": os
 * 5min por oitavo apareciam como se fossem conta e são convenção de mercado. Ela não rejeita
 * estimativa; rejeita estimativa disfarçada de cálculo. Por isso todo número sugerido declara a
 * origem, e "sem base pra estimar" é um resultado legítimo.
 *
 * Três estágios, nesta ordem: o que a AD digitou (inclui a decupagem dela), o realizado DESTE
 * projeto, e o ponto de partida DA PRODUÇÃO. Puro, sem prisma.
 *
 * A classificação de cena em quatro tipos (diálogo estático, com movimento, VFX, exterior) foi
 * aposentada: os tipos que mudam tempo de montagem são de PLANO, e master/estático-movimento/
 * detalhe já existem em Shot.ehMaster, Shot.movimento e Shot.tamanho — alimentando a classificação
 * de reset (classifyReset, src/lib/shots-shared.ts). Dar faixa própria a eles contaria o mesmo fato
 * duas vezes, e não ajudaria no caso que derrubou a AD: a primeira OD, sem decupagem nenhuma.
 */
import { formatTempoEstimado } from "@/lib/paginas";

/** Praxe de mercado — 1/8 de página ≈ 5min de filmagem. Continua sendo só o PADRÃO do campo do
 *  projeto: o número que aparece na tela é sempre o da produção, não este. */
export const CONVENCAO_MIN_POR_OITAVO = 5;

/** Ponto de partida da produção: um número por projeto, no lugar das quatro faixas por tipo de
 *  cena. Exterior recebe acréscimo percentual (Scene.tipo já diz INT/EXT); cena sem INT/EXT
 *  definido não recebe nada — não se cobra caro por falta de informação. */
export type PartidaDoProjeto = { minPorOitavo: number; acrescimoExteriorPercent: number };

export const MIN_POR_OITAVO_PADRAO = CONVENCAO_MIN_POR_OITAVO;
/** Exterior custa luz, clima e logística. 20% é ponto de partida editável, não medição. */
export const ACRESCIMO_EXTERIOR_PADRAO = 20;
export const PARTIDA_PADRAO: PartidaDoProjeto = {
  minPorOitavo: MIN_POR_OITAVO_PADRAO,
  acrescimoExteriorPercent: ACRESCIMO_EXTERIOR_PADRAO,
};

export const MIN_POR_OITAVO_MAX = 120;
export const ACRESCIMO_EXTERIOR_MAX = 200;

/** Ambiente da cena como o schema guarda: null = roteiro não deixou claro. */
export type AmbienteCena = "INT" | "EXT" | null;

/** Minutos de partida de uma cena: oitavos × o número da produção, com o acréscimo de exterior
 *  quando a cena É exterior. null quando não há nem páginas — aí é sem base mesmo. */
export function tempoDePartidaMin(
  oitavos: number,
  ambiente: AmbienteCena,
  partida: PartidaDoProjeto
): number | null {
  if (oitavos <= 0) return null;
  const base = oitavos * partida.minPorOitavo;
  if (ambiente !== "EXT" || partida.acrescimoExteriorPercent <= 0) return Math.round(base);
  return Math.round(base * (1 + partida.acrescimoExteriorPercent / 100));
}

/** "ponto de partida do projeto: 5min por oitavo" (+ "· +20% em exterior" quando se aplica). É o
 *  que substituiu "convenção: 5min por oitavo" — a diferença importa: um é escolha da produção, o
 *  outro é regra de mercado. */
export function textoDaPartida(partida: PartidaDoProjeto, ambiente: AmbienteCena = null): string {
  const base = `ponto de partida do projeto: ${partida.minPorOitavo}min por oitavo`;
  if (ambiente === "EXT" && partida.acrescimoExteriorPercent > 0) {
    return `${base} · +${partida.acrescimoExteriorPercent}% em exterior`;
  }
  return base;
}

/** O número que o CRONOGRAMA usa quando a cena não tem tempo próprio. Calculado na leitura, nunca
 *  gravado no import. Sem páginas não há nem partida: aí é "sem base pra estimar" mesmo. */
export function tempoDeReferenciaMin(
  tempoEstimadoMin: number | null,
  oitavos: number,
  partida: PartidaDoProjeto = PARTIDA_PADRAO,
  ambiente: AmbienteCena = null
): number | null {
  return tempoEstimadoMin ?? tempoDePartidaMin(oitavos, ambiente, partida);
}

// ---------------------------------------------------------------------------
// Estágio 2 — a média do realizado DESTE projeto
// ---------------------------------------------------------------------------

/** Uma cena já filmada e lançada. `oitavos` e `planos` são os DELA (parte de cena dividida conta a
 *  parte). Só entra aqui cena com início e fim lançados: previsto nunca se mistura com realizado. */
export type CenaFilmada = { shootDayId: string; realizadoMin: number; oitavos: number; planos: number };

export type MediaDoProjeto = {
  /** Diárias com pelo menos uma cena lançada. Abaixo de 2 não existe média: cai no estágio 3. */
  diarias: number;
  minPorPlano: number | null;
  minPorOitavo: number | null;
};

export const DIARIAS_MINIMAS_PARA_MEDIA = 2;

export function calcularMediaDoProjeto(cenas: CenaFilmada[]): MediaDoProjeto {
  const diarias = new Set(cenas.map((c) => c.shootDayId)).size;
  if (diarias < DIARIAS_MINIMAS_PARA_MEDIA) return { diarias, minPorPlano: null, minPorOitavo: null };

  const comPlanos = cenas.filter((c) => c.planos > 0);
  const comOitavos = cenas.filter((c) => c.oitavos > 0);
  const media = (lista: CenaFilmada[], base: (c: CenaFilmada) => number) => {
    const divisor = lista.reduce((s, c) => s + base(c), 0);
    if (divisor <= 0) return null;
    return Math.round(lista.reduce((s, c) => s + c.realizadoMin, 0) / divisor);
  };
  return {
    diarias,
    minPorPlano: media(comPlanos, (c) => c.planos),
    minPorOitavo: media(comOitavos, (c) => c.oitavos),
  };
}

// ---------------------------------------------------------------------------
// A origem de um número exibido
// ---------------------------------------------------------------------------

export type OrigemTempo =
  | { kind: "DIGITADO"; min: number }
  | { kind: "DURACAO_ALVO"; min: number }
  /** `resetsMin` e `fatorResetPercent` ficam DENTRO do total dos planos — o rótulo nomeia os dois,
   *  senão o tempo de troca entre planos (e o ritmo do dia) mexe no número calado. */
  | { kind: "PLANOS"; min: number; planos: number; resetsMin: number; fatorResetPercent: number }
  | { kind: "MEDIA_PROJETO"; min: number; base: "PLANO" | "OITAVO"; diarias: number }
  | { kind: "PARTIDA"; min: number; partida: PartidaDoProjeto; ambiente: AmbienteCena }
  /** Rod já gravado na diária que não bate com planos nem com duração alvo e não tem marca de
   *  digitado: veio de antes da marcação de origem. É o número que o cronograma usa, então
   *  aparece — com o aviso de que a origem se perdeu. */
  | { kind: "LEGADO"; min: number }
  | { kind: "SEM_BASE"; min: null; orientacao: string | null };

export type EntradaDaEstimativa = {
  /** Número que a AD digitou pra ESTA linha (Rod digitado na diária, ou tempo da cena editado). */
  digitadoMin?: number | null;
  /** Rod já gravado nesta linha da diária, sem marca de digitado. É o que o cronograma usa, então
   *  manda sobre qualquer estimativa: o rótulo tem que descrever o número que está no horário. */
  gravadoMin?: number | null;
  duracaoAlvoMin?: number | null;
  planosMin?: number | null;
  planos?: number;
  /** Parte do total dos planos que é tempo de troca, e o ritmo do dia aplicado a ela. */
  resetsMin?: number;
  fatorResetPercent?: number;
  oitavos: number;
  ambiente?: AmbienteCena;
  partida: PartidaDoProjeto;
  media?: MediaDoProjeto | null;
  /** SEM DEFAULT, de propósito: com default `true` toda tela caía no ponto de partida e "sem base
   *  pra estimar" nunca aparecia — a postura honesta que esta feature existe pra criar não chegava
   *  na tela. Cada chamador decide: true onde um número PRECISA existir pra haver horário
   *  (cronograma da diária), false onde é melhor dizer que não há base. */
  permitirPartida: boolean;
};

/** A ordem dos três estágios: o que a AD decidiu, o realizado deste projeto, e por último o ponto
 *  de partida da produção — que só entra onde um número precisa existir. */
export function resolverOrigemDoTempo(e: EntradaDaEstimativa): OrigemTempo {
  if (e.digitadoMin != null) return { kind: "DIGITADO", min: e.digitadoMin };
  if (e.duracaoAlvoMin != null) return { kind: "DURACAO_ALVO", min: e.duracaoAlvoMin };
  if (e.planosMin != null && e.planosMin > 0) {
    return {
      kind: "PLANOS",
      min: e.planosMin,
      planos: e.planos ?? 0,
      resetsMin: e.resetsMin ?? 0,
      fatorResetPercent: e.fatorResetPercent ?? 100,
    };
  }
  // Gravado sem origem conhecida: o horário já usa esse número, então é ele que a tela mostra.
  if (e.gravadoMin != null && e.gravadoMin > 0) return { kind: "LEGADO", min: e.gravadoMin };

  const media = e.media;
  if (media && media.diarias >= DIARIAS_MINIMAS_PARA_MEDIA) {
    if ((e.planos ?? 0) > 0 && media.minPorPlano != null) {
      return { kind: "MEDIA_PROJETO", min: media.minPorPlano * (e.planos ?? 0), base: "PLANO", diarias: media.diarias };
    }
    if (e.oitavos > 0 && media.minPorOitavo != null) {
      return { kind: "MEDIA_PROJETO", min: media.minPorOitavo * e.oitavos, base: "OITAVO", diarias: media.diarias };
    }
  }

  const ambiente = e.ambiente ?? null;
  const partidaMin = tempoDePartidaMin(e.oitavos, ambiente, e.partida);
  if (e.permitirPartida && partidaMin != null) {
    return { kind: "PARTIDA", min: partidaMin, partida: e.partida, ambiente };
  }
  return {
    kind: "SEM_BASE",
    min: null,
    // Mesmo sem base, a tela diz de onde SAIRIA um número — é assim que o ponto de partida da
    // produção fica visível, em vez de existir só no formulário de configuração.
    orientacao: partidaMin != null ? textoDaPartida(e.partida, ambiente) : null,
  };
}

/** Rótulo curto, o que vai entre parênteses depois do número. */
export function rotuloOrigem(o: OrigemTempo): string {
  switch (o.kind) {
    case "DIGITADO":
      return "você definiu";
    case "DURACAO_ALVO":
      return "tempo que você definiu";
    case "PLANOS": {
      const planos = `${o.planos} ${o.planos === 1 ? "plano" : "planos"}`;
      const resets = o.resetsMin > 0 ? ` + ${formatTempoEstimado(o.resetsMin)} de resets` : "";
      const ritmo = o.fatorResetPercent !== 100 ? ` · com ritmo de ${o.fatorResetPercent}%` : "";
      return `${planos}${resets}${ritmo}`;
    }
    case "MEDIA_PROJETO":
      return `média deste projeto, ${o.diarias} ${o.diarias === 1 ? "diária" : "diárias"}${
        o.base === "OITAVO" ? ", por oitavo" : ""
      }`;
    case "PARTIDA":
      return textoDaPartida(o.partida, o.ambiente);
    case "LEGADO":
      return "gravado antes desta versão — confira";
    case "SEM_BASE":
      return "sem base pra estimar";
  }
}

/** Forma curta pra coluna de PDF/planilha, com a legenda no rodapé do documento. */
export const LEGENDA_ORIGEM =
  "def. = você definiu · planos = soma dos planos (com resets) · média = média deste projeto · partida = ponto de partida do projeto";

export function rotuloOrigemCurto(o: OrigemTempo): string {
  switch (o.kind) {
    case "DIGITADO":
    case "DURACAO_ALVO":
      return "def.";
    case "PLANOS":
      return "planos";
    case "MEDIA_PROJETO":
      return "média";
    case "PARTIDA":
      return "partida";
    case "LEGADO":
      return "gravado";
    case "SEM_BASE":
      return "—";
  }
}

/** "40min (você definiu)" · "sem base pra estimar — ponto de partida do projeto: 5min por oitavo". */
export function textoComOrigem(o: OrigemTempo): string {
  if (o.kind === "SEM_BASE") {
    return o.orientacao ? `sem base pra estimar — ${o.orientacao}` : "sem base pra estimar";
  }
  return `${formatTempoEstimado(o.min)} (${rotuloOrigem(o)})`;
}

/** Nota de um total: soma de números de origens diferentes não tem uma origem só, então o rótulo
 *  diz qual é a MAIS fraca que entrou na conta — é ela que a AD precisa saber que está ali. */
export function notaDoTotal(origens: OrigemTempo[]): string | null {
  if (origens.some((o) => o.kind === "PARTIDA")) return "inclui ponto de partida do projeto";
  if (origens.some((o) => o.kind === "LEGADO")) return "inclui tempo gravado antes desta versão";
  if (origens.some((o) => o.kind === "MEDIA_PROJETO")) return "inclui média deste projeto";
  if (origens.some((o) => o.kind === "SEM_BASE")) return "inclui cena sem base pra estimar";
  return null;
}

/** "os planos somam 52min, você definiu 40min" — quando a decupagem discorda do que a AD digitou, o
 *  app NÃO sobrescreve: mostra os dois e ela decide (ver syncSceneRodMin, que pula linha digitada). */
export function avisoDigitadoVsPlanos(digitadoMin: number, planosMin: number): string | null {
  if (digitadoMin === planosMin) return null;
  return `os planos somam ${formatTempoEstimado(planosMin)}, você definiu ${formatTempoEstimado(digitadoMin)}`;
}
