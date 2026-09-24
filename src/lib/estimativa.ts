/**
 * De onde vem o tempo sugerido — e como dizer isso na tela.
 *
 * A AD abandonou a montagem da OD quando percebeu que o app sugeria tempo "sem base nenhuma": os
 * 5min por oitavo apareciam como se fossem conta e são convenção. Ela não rejeita estimativa;
 * rejeita estimativa disfarçada de cálculo. Por isso todo número sugerido passa a declarar a origem,
 * e "sem base pra estimar" é um resultado legítimo — campo vazio honesto é melhor que número
 * inventado.
 *
 * Três estágios, nesta ordem: o que a AD digitou (inclui a decupagem dela), o realizado DESTE
 * projeto, e a faixa genérica de ponto de partida. Puro, sem prisma.
 */
import { formatTempoEstimado } from "@/lib/paginas";

/** A convenção de mercado que era usada em silêncio. Continua sendo o último recurso pra montar
 *  horário (sem número nenhum a diária não tem cronograma e o almoço não tem onde cair), mas agora
 *  sempre rotulada. */
export const CONVENCAO_MIN_POR_OITAVO = 5;

/** O número que o CRONOGRAMA usa quando a cena não tem tempo próprio: a convenção, calculada na
 *  hora da leitura em vez de gravada no import. É a mesma conta de sempre — o que mudou é que ela
 *  deixou de virar dado com cara de decisão da AD e passou a aparecer rotulada. Sem páginas não há
 *  nem convenção: aí é "sem base pra estimar" mesmo. */
export function tempoDeReferenciaMin(tempoEstimadoMin: number | null, oitavos: number): number | null {
  return tempoEstimadoMin ?? (oitavos > 0 ? oitavos * CONVENCAO_MIN_POR_OITAVO : null);
}

export type ClassificacaoCena = "NAO_CLASSIFICADO" | "DIALOGO_ESTATICO" | "COM_MOVIMENTO" | "EFEITO_VFX" | "EXTERIOR";

export const CLASSIFICACAO_LABEL: Record<ClassificacaoCena, string> = {
  NAO_CLASSIFICADO: "Não classificado",
  DIALOGO_ESTATICO: "Diálogo estático",
  COM_MOVIMENTO: "Cena com movimento",
  EFEITO_VFX: "Cena com efeito ou VFX",
  EXTERIOR: "Exterior",
};

export const CLASSIFICACOES: ClassificacaoCena[] = [
  "NAO_CLASSIFICADO",
  "DIALOGO_ESTATICO",
  "COM_MOVIMENTO",
  "EFEITO_VFX",
  "EXTERIOR",
];

export type Faixa = { min: number; max: number };
export type FaixasDaClasse = { porPlano: Faixa; porOitavo: Faixa };
export type FaixasTempo = Record<Exclude<ClassificacaoCena, "NAO_CLASSIFICADO">, FaixasDaClasse>;

/** Ponto de partida quando o projeto ainda não tem realizado lançado. São chute de gente de set, não
 *  pesquisa — por isso o rótulo nunca diz "estimado" e a produção pode reescrever tudo isto em
 *  Project.faixasTempo. A faixa por oitavo existe porque na PRIMEIRA OD a cena não tem plano nenhum
 *  e a faixa por plano não teria o que multiplicar. */
export const FAIXAS_PADRAO: FaixasTempo = {
  DIALOGO_ESTATICO: { porPlano: { min: 8, max: 12 }, porOitavo: { min: 4, max: 7 } },
  COM_MOVIMENTO: { porPlano: { min: 15, max: 25 }, porOitavo: { min: 8, max: 14 } },
  EFEITO_VFX: { porPlano: { min: 25, max: 40 }, porOitavo: { min: 15, max: 25 } },
  EXTERIOR: { porPlano: { min: 20, max: 30 }, porOitavo: { min: 10, max: 18 } },
};

const ehFaixa = (v: unknown): v is Faixa =>
  typeof v === "object" &&
  v !== null &&
  Number.isFinite((v as Faixa).min) &&
  Number.isFinite((v as Faixa).max) &&
  (v as Faixa).min > 0 &&
  (v as Faixa).max >= (v as Faixa).min;

/** Lê Project.faixasTempo com o padrão como rede: valor corrompido ou classe faltando não pode
 *  derrubar a tela de planejamento inteira — cai no padrão daquela classe e segue. */
export function lerFaixas(json: unknown): FaixasTempo {
  if (typeof json !== "object" || json === null) return FAIXAS_PADRAO;
  const bruto = json as Record<string, unknown>;
  const saida = {} as FaixasTempo;
  for (const classe of Object.keys(FAIXAS_PADRAO) as (keyof FaixasTempo)[]) {
    const v = bruto[classe] as FaixasDaClasse | undefined;
    saida[classe] =
      v && ehFaixa(v.porPlano) && ehFaixa(v.porOitavo)
        ? { porPlano: { ...v.porPlano }, porOitavo: { ...v.porOitavo } }
        : FAIXAS_PADRAO[classe];
  }
  return saida;
}

export function formatFaixa(f: Faixa): string {
  return `${f.min} a ${f.max}min`;
}

/** "ponto de partida: 8 a 12min por plano · 4 a 7min por oitavo". É TEXTO DE ORIENTAÇÃO: nunca vira
 *  número gravado nem horário — na primeira OD a cena não tem plano, e chutar quantos planos ela
 *  teria recriaria o problema que fez a AD desistir. */
export function textoDeOrientacao(classificacao: ClassificacaoCena, faixas: FaixasTempo): string | null {
  if (classificacao === "NAO_CLASSIFICADO") return null;
  const f = faixas[classificacao];
  return `ponto de partida: ${formatFaixa(f.porPlano)} por plano · ${formatFaixa(f.porOitavo)} por oitavo`;
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
  | { kind: "PLANOS"; min: number; planos: number }
  | { kind: "MEDIA_PROJETO"; min: number; base: "PLANO" | "OITAVO"; diarias: number }
  | { kind: "CONVENCAO"; min: number }
  /** Rod já gravado na diária que não bate com planos nem com duração alvo e não tem marca de
   *  digitado: veio de antes desta versão (o arraste gravava a convenção). É o número que o
   *  cronograma usa, então tem que aparecer — com o aviso de que a origem se perdeu. */
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
  oitavos: number;
  classificacao?: ClassificacaoCena;
  faixas?: FaixasTempo;
  media?: MediaDoProjeto | null;
  /** false nas telas que preferem "sem base" a mostrar a convenção (a estimativa da cena);
   *  true onde é preciso um número pra existir horário (cronograma da diária). */
  permitirConvencao?: boolean;
};

/** A ordem dos três estágios: o que a AD decidiu, o realizado deste projeto, e por último a
 *  convenção — que só entra onde um número precisa existir. Sem nada disso: sem base pra estimar. */
export function resolverOrigemDoTempo(e: EntradaDaEstimativa): OrigemTempo {
  if (e.digitadoMin != null) return { kind: "DIGITADO", min: e.digitadoMin };
  if (e.duracaoAlvoMin != null) return { kind: "DURACAO_ALVO", min: e.duracaoAlvoMin };
  if (e.planosMin != null && e.planosMin > 0) return { kind: "PLANOS", min: e.planosMin, planos: e.planos ?? 0 };
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

  if (e.permitirConvencao && e.oitavos > 0) {
    return { kind: "CONVENCAO", min: e.oitavos * CONVENCAO_MIN_POR_OITAVO };
  }
  return {
    kind: "SEM_BASE",
    min: null,
    orientacao: e.classificacao ? textoDeOrientacao(e.classificacao, e.faixas ?? FAIXAS_PADRAO) : null,
  };
}

/** Rótulo curto, o que vai entre parênteses depois do número. */
export function rotuloOrigem(o: OrigemTempo): string {
  switch (o.kind) {
    case "DIGITADO":
      return "você definiu";
    case "DURACAO_ALVO":
      return "duração que você definiu";
    case "PLANOS":
      return o.planos > 0 ? `soma de ${o.planos} ${o.planos === 1 ? "plano" : "planos"}` : "soma dos planos";
    case "MEDIA_PROJETO":
      return `média deste projeto, ${o.diarias} ${o.diarias === 1 ? "diária" : "diárias"}${
        o.base === "OITAVO" ? ", por oitavo" : ""
      }`;
    case "CONVENCAO":
      return `convenção: ${CONVENCAO_MIN_POR_OITAVO}min por oitavo`;
    case "LEGADO":
      return "gravado antes desta versão — confira";
    case "SEM_BASE":
      return "sem base pra estimar";
  }
}

/** Forma curta pra coluna de PDF/planilha, com a legenda no rodapé do documento. */
export const LEGENDA_ORIGEM = "def. = você definiu · planos = soma dos planos · média = média deste projeto · conv. = convenção de 5min por oitavo";

export function rotuloOrigemCurto(o: OrigemTempo): string {
  switch (o.kind) {
    case "DIGITADO":
    case "DURACAO_ALVO":
      return "def.";
    case "PLANOS":
      return "planos";
    case "MEDIA_PROJETO":
      return "média";
    case "LEGADO":
      return "gravado";
    case "CONVENCAO":
      return "conv.";
    case "SEM_BASE":
      return "—";
  }
}

/** "40min (você definiu)" · "8 a 12min (ponto de partida, classifique a cena pra afinar)" quando não
 *  há base; sem classificação, só "sem base pra estimar". */
export function textoComOrigem(o: OrigemTempo): string {
  if (o.kind === "SEM_BASE") {
    return o.orientacao ? `sem base pra estimar — ${o.orientacao}` : "sem base pra estimar";
  }
  return `${formatTempoEstimado(o.min)} (${rotuloOrigem(o)})`;
}

/** Nota de um total: soma de números de origens diferentes não tem uma origem só, então o rótulo diz
 *  qual é a MAIS fraca que entrou na conta — é ela que a AD precisa saber que está ali. */
export function notaDoTotal(origens: OrigemTempo[]): string | null {
  if (origens.some((o) => o.kind === "CONVENCAO")) return `inclui tempo de convenção (${CONVENCAO_MIN_POR_OITAVO}min por oitavo)`;
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
