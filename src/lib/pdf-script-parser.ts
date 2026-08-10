/**
 * Parser de roteiro em PDF, por GEOMETRIA — não há tipos de parágrafo como no .fdx (Scene
 * Heading/Action/Character), só texto posicionado (x/y). A ideia central: roteiro tem margens
 * fixas por elemento (cabeçalho/ação/diálogo/parêntese/personagem/transição), então agrupamos
 * linhas por posição X e descobrimos empiricamente a QUE margem cada cluster corresponde — nunca
 * assumimos os valores "de manual" (1.5"/2.5"/3.1"/3.7"), porque Final Draft, WriterDuet, Celtx e
 * roteiro brasileiro variam a margem real usada (calibrado contra um roteiro real: aqui os
 * valores medidos foram ~108/180/208.8/252pt, não os "padrão" 108/180/223/266).
 */
import { suggestTempoEstimadoMin } from "@/lib/paginas";
import {
  applyClasseLuzInheritance,
  deriveClasseLuz,
  detectSetFusionSuggestions,
  isPeriodoTextoReconhecido,
  LINHAS_POR_PAGINA_PADRAO,
  normalizeCharacterName,
} from "@/lib/fdx-parser";

import type { FdxParseResult, FdxScene } from "@/lib/fdx-parser";
import type { ExtractedPage, Line, RawItem } from "@/lib/pdf-script-types";

export class PdfScriptStructureError extends Error {}

const UNRECOGNIZED_STRUCTURE_MESSAGE =
  "Não foi possível reconhecer a estrutura deste PDF. Ele pode ser um documento escaneado ou não seguir a formatação padrão de roteiro. Envie um arquivo .fdx.";
const INVALID_PAYLOAD_MESSAGE =
  "Não foi possível processar os dados extraídos do PDF. Selecione o arquivo novamente.";

// Abaixo desse total de caracteres extraídos do documento inteiro, tratamos como PDF escaneado
// (imagem sem camada de texto) — não tentamos OCR, só recusamos com mensagem clara. A mesma
// checagem roda no navegador (pdf-script-extract-browser.ts, pra falhar rápido) E aqui (defesa —
// o servidor nunca confia cegamente no que o cliente diz ter extraído).
const MIN_TOTAL_CHARS = 50;

// Limites de sanidade pro payload já extraído que o navegador envia — nada aqui deveria nunca ser
// ultrapassado por uma extração real de roteiro (mesmo um longa de 150 páginas fica bem abaixo),
// então estourar qualquer um destes é tratado como payload malformado/adulterado, não como um
// roteiro grande demais.
const MAX_PAGES = 500;
const MAX_LINES_PER_PAGE = 500;
const MAX_ITEMS_PER_LINE = 200;
const MAX_ITEM_TEXT_LENGTH = 1000;
const MAX_LINE_TEXT_LENGTH = 4000;
const MAX_COORDINATE = 20000;

// Alinhamento em cluster: duas linhas pertencem à mesma margem se o X inicial delas está dentro
// dessa tolerância uma da outra. Cabeçalhos de ato (texto CENTRALIZADO, não alinhado a uma
// margem fixa) caem FORA de qualquer cluster real por construção — é assim que "ignoramos" esse
// tipo de linha sem precisar de uma regra dedicada pra reconhecê-la.
const CLUSTER_TOLERANCE_PT = 5;
const MIN_CLUSTER_OCCURRENCES = 2;

const TIPO_PREFIX_PATTERN = /^(?:INT|EXT|I\/E|E\/I)(?:[\s./]*(?:INT|EXT))?[.\s]+/i;
const TRANSICAO_PATTERN = /^[A-ZÀ-Ú][A-ZÀ-Ú0-9\s.'-]*:$/;
const PARENTETICO_PATTERN = /^\(.*\)$/;
// Marcações estruturais que não são cena nem personagem (ver comentário em classifyActionLine).
const MONTAGEM_PATTERN = /^(INÍCIO DE MONTAGEM|FIM(?: DA MONTAGEM)?\.?|--.*)$/i;
const LOCAL_PERIODO_SEPARATOR = /\s+(?:[-–—]|\/)\s+/g;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateRawItem(raw: unknown): RawItem {
  if (
    !raw ||
    typeof raw !== "object" ||
    typeof (raw as RawItem).text !== "string" ||
    (raw as RawItem).text.length > MAX_ITEM_TEXT_LENGTH ||
    !isFiniteNumber((raw as RawItem).x0) ||
    Math.abs((raw as RawItem).x0) > MAX_COORDINATE ||
    !isFiniteNumber((raw as RawItem).x1) ||
    Math.abs((raw as RawItem).x1) > MAX_COORDINATE
  ) {
    throw new PdfScriptStructureError(INVALID_PAYLOAD_MESSAGE);
  }
  const item = raw as RawItem;
  return { text: item.text, x0: item.x0, x1: item.x1 };
}

function validateLine(raw: unknown): Line {
  if (
    !raw ||
    typeof raw !== "object" ||
    !isFiniteNumber((raw as Line).page) ||
    !isFiniteNumber((raw as Line).y) ||
    Math.abs((raw as Line).y) > MAX_COORDINATE ||
    typeof (raw as Line).text !== "string" ||
    (raw as Line).text.length > MAX_LINE_TEXT_LENGTH ||
    !Array.isArray((raw as Line).items) ||
    (raw as Line).items.length > MAX_ITEMS_PER_LINE
  ) {
    throw new PdfScriptStructureError(INVALID_PAYLOAD_MESSAGE);
  }
  const line = raw as Line;
  return { page: line.page, y: line.y, text: line.text, items: line.items.map(validateRawItem) };
}

/** Valida a estrutura do JSON que o navegador extraiu antes de processar — o servidor nunca
 *  confia cegamente no payload recebido, mesmo vindo da própria UI do app. */
export function parseExtractedPagesPayload(raw: unknown): ExtractedPage[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PAGES) {
    throw new PdfScriptStructureError(INVALID_PAYLOAD_MESSAGE);
  }
  return raw.map((rawPage) => {
    if (
      !rawPage ||
      typeof rawPage !== "object" ||
      !isFiniteNumber((rawPage as ExtractedPage).pageWidth) ||
      (rawPage as ExtractedPage).pageWidth <= 0 ||
      (rawPage as ExtractedPage).pageWidth > MAX_COORDINATE ||
      !isFiniteNumber((rawPage as ExtractedPage).pageHeight) ||
      (rawPage as ExtractedPage).pageHeight <= 0 ||
      (rawPage as ExtractedPage).pageHeight > MAX_COORDINATE ||
      !Array.isArray((rawPage as ExtractedPage).lines) ||
      (rawPage as ExtractedPage).lines.length > MAX_LINES_PER_PAGE
    ) {
      throw new PdfScriptStructureError(INVALID_PAYLOAD_MESSAGE);
    }
    const page = rawPage as ExtractedPage;
    return { pageWidth: page.pageWidth, pageHeight: page.pageHeight, lines: page.lines.map(validateLine) };
  });
}

/** X do conteúdo "de verdade" da linha — pula um eventual número de cena isolado (item só de
 *  dígitos) na ponta esquerda, que vive numa coluna própria bem mais à esquerda de qualquer
 *  margem de elemento (cabeçalho/ação/diálogo/...). Sem isso, uma linha de cabeçalho de cena
 *  ("1 INT. CASA...") seria erroneamente classificada pela coluna do NÚMERO, não do cabeçalho. */
function primaryX(line: Line): number {
  // Um número de cena isolado ("1", "10") costuma vir seguido de um item só de ESPAÇO em branco
  // (o "tab" até a coluna do cabeçalho) antes do texto de verdade — pula os dois, não só dígitos.
  const content = line.items.find((i) => !/^\d+$/.test(i.text.trim()) && i.text.trim().length > 0);
  return (content ?? line.items[0]).x0;
}

type Cluster = { center: number; count: number };

function detectClusters(allLines: Line[]): Cluster[] {
  const xs = allLines.map((l) => primaryX(l)).sort((a, b) => a - b);
  const clusters: Cluster[] = [];
  for (const x of xs) {
    const last = clusters[clusters.length - 1];
    if (last && x - last.center <= CLUSTER_TOLERANCE_PT) {
      last.center = (last.center * last.count + x) / (last.count + 1);
      last.count += 1;
    } else {
      clusters.push({ center: x, count: 1 });
    }
  }
  return clusters.filter((c) => c.count >= MIN_CLUSTER_OCCURRENCES);
}

function findCluster(clusters: Cluster[], x: number): Cluster | null {
  let best: Cluster | null = null;
  let bestDist = Infinity;
  for (const c of clusters) {
    const dist = Math.abs(c.center - x);
    if (dist <= CLUSTER_TOLERANCE_PT && dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

/** Texto da linha sem um eventual número de cena isolado (item só de dígitos) nas pontas —
 *  usado tanto pra identificar o cluster de cabeçalho/ação quanto pra extrair o texto real do
 *  cabeçalho separado dos números dos dois lados. */
function stripSceneNumbers(items: RawItem[], pageWidth: number, actionCenter: number | null) {
  let start = 0;
  let end = items.length;
  let leftNumber: string | null = null;
  let rightNumber: string | null = null;

  if (items.length > 1 && /^\d+$/.test(items[0].text.trim())) {
    const isLeftOfAction = actionCenter == null || items[0].x0 < actionCenter - 15;
    if (isLeftOfAction) {
      leftNumber = items[0].text.trim();
      start = 1;
    }
  }
  const lastItem = items[items.length - 1];
  if (end > start && /^\d+$/.test(lastItem.text.trim()) && lastItem.x0 > pageWidth * 0.8) {
    rightNumber = lastItem.text.trim();
    end -= 1;
  }

  const text = items
    .slice(start, end)
    .map((i) => i.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return { text, leftNumber, rightNumber };
}

function parseHeadingBody(raw: string): {
  tipo: FdxScene["tipo"];
  set: string | null;
  locacaoNome: string | null;
  periodo: string | null;
  periodoFim: string | null;
  classeLuz: FdxScene["classeLuz"];
} {
  const hasTipoPrefix = TIPO_PREFIX_PATTERN.test(raw);
  const tipo: FdxScene["tipo"] = hasTipoPrefix ? (/^EXT/i.test(raw) ? "EXT" : "INT") : null;
  const body = (hasTipoPrefix ? raw.replace(TIPO_PREFIX_PATTERN, "") : raw).trim() || raw;

  // O que vem depois do ÚLTIMO separador é SEMPRE período, sem gate contra lista fechada — ver
  // o mesmo raciocínio (e o defeito que isso corrige) em parseHeading/fdx-parser.ts. Texto não
  // reconhecido é preservado aqui e classificado como INDEFINIDO por deriveClasseLuz, nunca
  // devolvido pro nome do local.
  let local = body;
  let periodoTexto: string | null = null;
  const matches = [...body.matchAll(LOCAL_PERIODO_SEPARATOR)];
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const before = body.slice(0, last.index ?? 0).trim();
    const after = body.slice((last.index ?? 0) + last[0].length).trim();
    local = before;
    periodoTexto = after ? after.toUpperCase() : null;
  }

  // Convenção "LOCAL; SET" (ver comentário no topo do arquivo e em locacao-import.ts) — o que
  // vem antes do ";" agrupa vários sets na MESMA Locacao; sem ";", locação e set são o mesmo
  // valor (igual ao comportamento de sempre do import de .fdx).
  const semicolon = local.indexOf(";");
  const locacaoNome = semicolon >= 0 ? local.slice(0, semicolon).trim().toUpperCase() || null : null;
  const set = (semicolon >= 0 ? local.slice(semicolon + 1).trim() : local).toUpperCase() || null;
  const { classeLuz, periodoFim } = deriveClasseLuz(periodoTexto);

  return { tipo, set, locacaoNome: locacaoNome ?? set, periodo: periodoTexto, periodoFim, classeLuz };
}

// Pistas de descrição de pessoa (idade/nacionalidade/parentesco) — ver comentário na função que
// usa este padrão. Não é uma lista fechada; é propositalmente ampla pra favorecer recall (melhor
// marcar um objeto como personagem por engano — descartável na prévia — do que perder gente muda).
// ANCORADO em "^," — a descrição precisa vir COLADA na frase ("YASMIN, 27 anos"), não em qualquer
// lugar dos próximos 60 caracteres. Sem essa âncora, um objeto citado perto de uma palavra como
// "mãe" por coincidência (ex.: "um PORTA-RETRATO da Mãe") seria classificado como personagem.
const PERSON_DESCRIPTOR_PATTERN =
  /^,\s*(?:um|uma)?\s*\d+\s*anos|^,\s*(?:um|uma)\s+\S*(?:brasileir|paulist|carioc|japon|americ|europe)\w*|^,\s*(?:um|uma)?\s*(?:m[ãa]e|pai|irm[ãa]o|irm[ãa]|filho|filha|av[oó])\b/i;
// "SUJEITO se <verbo>" é o padrão mais comum de ação reflexiva em português ("se aproxima", "se
// ajoelha", "se levanta") — um personagem sem descrição textual (ex.: um espírito, uma entidade)
// ainda aparece como AGENTE de uma ação assim, o que objetos de cena não fazem.
const REFLEXIVE_VERB_FOLLOWS_PATTERN = /^[,.]?\s*se\s+\w/i;
// "Yasmin VÊ o ESPÍRITO..." — verbo de percepção/encontro logo antes introduz um novo agente na
// cena mesmo sem descrição e sem verbo reflexivo próprio (ele aparece como OBJETO gramatical da
// percepção de outro personagem, não como sujeito).
const PERCEPTION_VERB_PRECEDES_PATTERN = /\b(?:v[êe]|avista|percebe|nota|encontra|descobre|surge|aparece)\s+(?:o|a)\s*$/i;

// Número de página automático do Final Draft: uma linha isolada, só dígitos (+ ponto opcional).
// Calibrado contra um roteiro real: o número às vezes renderiza DUPLICADO ("3.3." em vez de "3." —
// artefato do exportador, o dígito desenhado duas vezes) — por isso aceita 1 OU 2 repetições, não
// só uma. Precisa ser descartada ANTES de medir geometria (passo/topoDoCorpo), senão distorce a
// medição pra cima: ela fica ACIMA da margem real do corpo, então contaminar a "primeira linha da
// página" com ela infla linhasPorPagina e desalinha o índice de toda cena que atravessa página.
const PAGE_NUMBER_LINE_PATTERN = /^(?:\d+\.?){1,2}$/;
// Sinal solto (sem exigir "^", só um cabeçalho reconhecível em algum lugar da linha) pra decidir
// se uma página é "de conteúdo" (tem roteiro de verdade) vs. capa/título — mais barato que rodar
// stripSceneNumbers página por página só pra essa classificação.
const CONTENT_PAGE_HEADING_HINT = /\b(?:INT|EXT|I\/E|E\/I)[.\s]/i;

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  let best = values[0];
  let bestCount = 0;
  for (const v of values) {
    const count = (counts.get(v) ?? 0) + 1;
    counts.set(v, count);
    if (count > bestCount) {
      bestCount = count;
      best = v;
    }
  }
  return best;
}

type PageGeometry = { passo: number; linhasPorPagina: number; topoDoCorpo: number; linesByPage: Map<number, Line[]> };

/** topoDoCorpo = Y comum a TODAS as páginas de conteúdo (nunca "a menor linha do documento
 *  inteiro" — a capa/título e a primeira página do roteiro não têm número de página, então o
 *  mínimo global mentiria sobre a margem real do corpo). Interseção, não moda: um Y presente em
 *  toda página de conteúdo só pode ser a margem física — não depende de nenhuma página específica
 *  "vencer a votação". */
function computeTopoDoCorpo(linesByPage: Map<number, Line[]>): number {
  const contentPagesLines = [...linesByPage.values()].filter((lines) =>
    lines.some((l) => CONTENT_PAGE_HEADING_HINT.test(l.text))
  );
  const pool = contentPagesLines.length > 0 ? contentPagesLines : [...linesByPage.values()];

  let candidates: Set<number> | undefined;
  for (const lines of pool) {
    if (lines.length === 0) continue;
    const ys = new Set(lines.map((l) => Math.round(l.y * 2) / 2));
    const previous: Set<number> | undefined = candidates;
    candidates = previous === undefined ? ys : new Set([...previous].filter((y) => ys.has(y)));
  }
  if (candidates !== undefined && candidates.size > 0) {
    // Maior Y (convenção bottom-up) = mais perto do topo físico da página = "menor top".
    return Math.max(...candidates);
  }

  // Nenhum Y comum a todas as páginas de conteúdo (documento muito irregular) — cai pra moda da
  // primeira linha de cada uma, ainda melhor que usar a página inteira (capa/título inclusas).
  const firstLineYs = pool.filter((lines) => lines.length > 0).map((lines) => Math.round(lines[0].y * 2) / 2);
  return firstLineYs.length > 0 ? mode(firstLineYs) : 0;
}

/** Mede a geometria real do PDF em vez de assumir margens de manual (1" topo/rodapé) — cada
 *  exportador (Final Draft, WriterDuet, Celtx, roteiro brasileiro) usa uma margem levemente
 *  diferente. `linhasPorPagina` aqui é só informativo/diagnóstico — o cálculo de linhas por cena
 *  (countLinesInRange) soma por página e nunca usa esse valor (ver comentário lá: um
 *  linhasPorPagina errado nunca deveria poder desalinhar uma cena que atravessa página). */
function computePageGeometry(pages: ExtractedPage[]): PageGeometry {
  const linesByPage = new Map<number, Line[]>();
  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    linesByPage.set(
      pageNumber,
      page.lines.filter((l) => !PAGE_NUMBER_LINE_PATTERN.test(l.text.trim()))
    );
  });

  // Passo: NÃO é a moda bruta das diferenças entre tops consecutivos — a formatação de roteiro
  // insere uma linha em branco antes de cabeçalho/ação/personagem/transição (ver
  // BLANK_LINE_BEFORE_TYPES no parser de .fdx), então o vão de "uma linha em branco + a de baixo"
  // (2x o passo, ex.: 24pt) pode aparecer com MAIS frequência bruta que o passo de verdade (12pt)
  // num roteiro com bastante diálogo curto — a moda simples pegaria o múltiplo errado. O passo
  // real é o MENOR valor entre os que se repetem com frequência (todo parágrafo com 2+ linhas
  // produz um vão de 1 passo; vãos maiores são sempre múltiplos dele, nunca menores).
  const MIN_OCCURRENCES_FOR_STEP = 3;
  const diffCounts = new Map<number, number>();
  for (const lines of linesByPage.values()) {
    for (let i = 1; i < lines.length; i++) {
      const diff = Math.round((lines[i - 1].y - lines[i].y) * 2) / 2;
      if (diff > 0) diffCounts.set(diff, (diffCounts.get(diff) ?? 0) + 1);
    }
  }
  const frequentDiffs = [...diffCounts.entries()].filter(([, count]) => count >= MIN_OCCURRENCES_FOR_STEP).map(([value]) => value);
  const passo =
    frequentDiffs.length > 0
      ? Math.min(...frequentDiffs)
      : diffCounts.size > 0
        ? Math.min(...diffCounts.keys())
        : 12;

  const topoDoCorpo = computeTopoDoCorpo(linesByPage);

  // Só informativo (ver doc da função) — vão da página mais cheia, mesma lógica de sempre.
  let maxSpan = 0;
  for (const lines of linesByPage.values()) {
    if (lines.length === 0) continue;
    const span = lines[0].y - lines[lines.length - 1].y;
    if (span > maxSpan) maxSpan = span;
  }
  const linhasPorPagina = Math.max(1, Math.round(maxSpan / passo) + 1);

  return { passo, linhasPorPagina, topoDoCorpo, linesByPage };
}

/** Linhas ocupadas entre duas posições do roteiro (início de uma cena até o início da seguinte,
 *  ou até o fim do documento) — soma página por página, NUNCA multiplica por um "linhasPorPagina"
 *  global. Cada página contribui (topoDaContribuição - topoDaÚltimaLinhaRelevante)/passo + 1:
 *  a primeira página da cena começa no próprio cabeçalho; páginas seguintes começam em
 *  topoDoCorpo (margem física, igual em toda página); a última página da cena termina na última
 *  linha ANTES do cabeçalho seguinte (ou na última linha real da cena, se ela for a última do
 *  documento); páginas do meio (a cena atravessa 2+ quebras) terminam na própria última linha da
 *  página. O espaço vazio no rodapé de uma página quebrada não pertence a cena nenhuma — por
 *  construção, essa soma nunca inclui esse espaço. */
function countLinesInRange(
  startPage: number,
  startY: number,
  endPage: number,
  endY: number,
  geometry: PageGeometry
): number {
  const { linesByPage, topoDoCorpo, passo } = geometry;
  let total = 0;
  for (let page = startPage; page <= endPage; page++) {
    const lines = linesByPage.get(page) ?? [];
    const pageStartY = page === startPage ? startY : topoDoCorpo;

    let pageEndY: number;
    if (page === endPage) {
      // Só as linhas estritamente acima do limite (o cabeçalho seguinte, ou a referência de fim
      // de documento) contam pra esta cena.
      const before = lines.filter((l) => l.y > endY);
      if (before.length === 0) continue; // nada desta cena cai nesta página
      pageEndY = before[before.length - 1].y;
    } else {
      if (lines.length === 0) continue;
      pageEndY = lines[lines.length - 1].y;
    }

    if (pageStartY < pageEndY) continue; // defensivo — não deveria acontecer
    total += Math.round((pageStartY - pageEndY) / passo) + 1;
  }
  return Math.max(1, total);
}

function extractCapsPhrasesWithContext(text: string): { phrase: string; before: string; after: string }[] {
  const results: { phrase: string; before: string; after: string }[] = [];
  // Sequência de 1+ palavras em maiúscula (permitindo acentos), não uma letra solta.
  const regex = /\b(?:[A-ZÀ-Ú]{2,}(?:[-'][A-ZÀ-Ú]{2,})?)(?:\s+(?:DE|DA|DO|DAS|DOS|E)?\s*[A-ZÀ-Ú]{2,})*\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    results.push({
      phrase: match[0].trim(),
      before: text.slice(Math.max(0, match.index - 20), match.index),
      after: text.slice(match.index + match[0].length, match.index + match[0].length + 60),
    });
  }
  return results;
}

/** Recebe as páginas já extraídas no navegador (ver pdf-script-extract-browser.ts) e faz toda a
 *  interpretação geométrica — clusters de margem, classificação de elementos, oitavos, heurística
 *  de personagem/objeto. Nenhuma dependência de pdfjs aqui: essa função é pura sobre a estrutura
 *  { lines, pageWidth, pageHeight }[], por isso roda no servidor sem precisar de canvas/DOMMatrix. */
export function buildScriptFromPdfPages(pages: ExtractedPage[]): FdxParseResult {
  const allLines = pages.flatMap((p) => p.lines);
  const totalChars = allLines.reduce((sum, l) => sum + l.text.length, 0);
  if (totalChars < MIN_TOTAL_CHARS) {
    throw new PdfScriptStructureError(UNRECOGNIZED_STRUCTURE_MESSAGE);
  }

  const clusters = detectClusters(allLines);
  const actionCluster = clusters.find((c) =>
    allLines.some((l) => findCluster([c], primaryX(l)) && TIPO_PREFIX_PATTERN.test(stripSceneNumbers(l.items, 0, null).text))
  );
  if (!actionCluster) {
    throw new PdfScriptStructureError(UNRECOGNIZED_STRUCTURE_MESSAGE);
  }

  const rightClusters = clusters.filter((c) => c.center > actionCluster.center + CLUSTER_TOLERANCE_PT);
  // Personagem: cluster (à direita da ação) cuja imensa maioria das linhas é maiúscula e curta —
  // nenhum outro elemento do roteiro (ação/diálogo) tem essa proporção de linhas 100% em caps.
  let personagemCluster: Cluster | null = null;
  let bestCapsRatio = 0;
  for (const cluster of rightClusters) {
    const linesHere = allLines.filter((l) => findCluster([cluster], primaryX(l)));
    if (linesHere.length === 0) continue;
    const capsShort = linesHere.filter((l) => l.text.length <= 45 && l.text === l.text.toUpperCase());
    const ratio = capsShort.length / linesHere.length;
    if (ratio > bestCapsRatio) {
      bestCapsRatio = ratio;
      personagemCluster = cluster;
    }
  }
  const dialogoClusters = rightClusters.filter(
    (c) => c !== personagemCluster && (!personagemCluster || c.center < personagemCluster.center)
  );
  // Parêntese: qualquer cluster candidato a diálogo cujas linhas são majoritariamente "(...)".
  const parenteseCluster =
    dialogoClusters.find((c) => {
      const linesHere = allLines.filter((l) => findCluster([c], primaryX(l)));
      return linesHere.length > 0 && linesHere.every((l) => PARENTETICO_PATTERN.test(l.text));
    }) ?? null;
  const dialogoCluster = dialogoClusters.find((c) => c !== parenteseCluster) ?? null;

  type SceneAccumulator = {
    scene: FdxScene;
    startPage: number;
    startY: number;
    acaoTexto: string[];
    personagensComFala: Set<string>;
  };
  const accumulators: SceneAccumulator[] = [];
  const knownNamesUpper = new Set<string>();
  let sequencial = 0;

  for (const page of pages) {
    for (const line of page.lines) {
      const lineX = primaryX(line);
      const inAction = findCluster([actionCluster], lineX);
      if (inAction) {
        const { text, leftNumber, rightNumber } = stripSceneNumbers(line.items, page.pageWidth, actionCluster.center);
        if (TIPO_PREFIX_PATTERN.test(text)) {
          const { tipo, set, locacaoNome, periodo, periodoFim, classeLuz } = parseHeadingBody(text);
          const numero = leftNumber ?? rightNumber;
          sequencial += 1;
          accumulators.push({
            scene: {
              numero: numero ?? String(sequencial),
              numeroGerado: numero == null,
              tipo,
              periodo,
              periodoFim,
              classeLuz,
              set,
              locacaoNome,
              sinopse: null,
              personagens: [],
              personagensSemFala: [],
              paginas: 0,
              linhas: 0,
              tempoEstimadoMinSugerido: 0,
            },
            startPage: line.page,
            startY: line.y,
            acaoTexto: [],
            personagensComFala: new Set(),
          });
          continue;
        }
        if (MONTAGEM_PATTERN.test(text)) continue;
        const current = accumulators[accumulators.length - 1];
        if (current) current.acaoTexto.push(text);
        continue;
      }

      if (personagemCluster && findCluster([personagemCluster], lineX)) {
        const current = accumulators[accumulators.length - 1];
        if (!current) continue;
        const nome = normalizeCharacterName(line.text);
        if (nome) {
          current.personagensComFala.add(nome);
          knownNamesUpper.add(nome);
        }
        continue;
      }

      if (dialogoCluster && findCluster([dialogoCluster], lineX)) continue;
      if (parenteseCluster && findCluster([parenteseCluster], lineX)) continue;

      // Transição ("CORTA PARA:") — reconhecida só pelo padrão de texto (maiúscula terminando em
      // ":"), independente de cluster: é rara o bastante pra não formar um cluster com >=2
      // ocorrências, e right-aligned varia demais entre arquivos pra confiar só na posição.
      if (TRANSICAO_PATTERN.test(line.text) && lineX > page.pageWidth * 0.55) continue;

      // Não bateu em nenhum cluster reconhecido nem no padrão de transição — cabeçalho de ato
      // (texto centralizado, ver comentário no topo) ou número de página solto. Ignorar.
    }
  }

  if (accumulators.length === 0) {
    throw new PdfScriptStructureError(UNRECOGNIZED_STRUCTURE_MESSAGE);
  }

  // Oitavo mede ESPAÇO DE PÁGINA: uma cena vai do seu cabeçalho até a linha imediatamente
  // anterior ao cabeçalho seguinte, e TODA linha nesse intervalo conta — inclusive as vazias,
  // nome de personagem, parêntese, transição. countLinesInRange soma por página (ver doc da
  // função) — não depende de linhasPorPagina, só do passo e do topoDoCorpo medidos.
  const geometry = computePageGeometry(pages);
  // Denominador do oitavo é convenção da indústria, não a capacidade medida desta página (ver
  // LINHAS_POR_PAGINA_PADRAO em fdx-parser.ts) — igual pro .fdx, pra PDF e .fdx do MESMO roteiro
  // convergirem no mesmo resultado.
  const linhasPorOitavo = LINHAS_POR_PAGINA_PADRAO / 8;

  const lastPageLines = geometry.linesByPage.get(pages.length) ?? [];
  const lastLine = lastPageLines[lastPageLines.length - 1];
  const docEndPage = pages.length;
  const docEndY = lastLine ? lastLine.y - geometry.passo / 2 : geometry.topoDoCorpo - geometry.passo / 2;

  for (let i = 0; i < accumulators.length; i++) {
    const acc = accumulators[i];
    const next = accumulators[i + 1];
    const linhas = next
      ? countLinesInRange(acc.startPage, acc.startY, next.startPage, next.startY, geometry)
      : countLinesInRange(acc.startPage, acc.startY, docEndPage, docEndY, geometry);
    const eighths = Math.max(1, Math.round(linhas / linhasPorOitavo));
    acc.scene.linhas = linhas;
    acc.scene.paginas = eighths / 8;
    acc.scene.tempoEstimadoMinSugerido = suggestTempoEstimadoMin(acc.scene.paginas);

    const acaoFull = acc.acaoTexto.join(" ").replace(/\s+/g, " ").trim();
    acc.scene.sinopse = acaoFull ? (acaoFull.length > 200 ? `${acaoFull.slice(0, 200).trimEnd()}…` : acaoFull) : null;

    // Heurística de personagem/objeto na ação — ver PERSON_DESCRIPTOR_PATTERN e
    // REFLEXIVE_VERB_FOLLOWS_PATTERN acima. Só considera a PRIMEIRA menção de cada frase em
    // maiúscula em todo o documento (convenção de roteiro); menções repetidas de um mesmo objeto
    // não viram novo candidato.
    const semFalaAqui = new Set<string>();
    for (const trecho of acc.acaoTexto) {
      for (const { phrase, before, after } of extractCapsPhrasesWithContext(trecho)) {
        const nome = normalizeCharacterName(phrase);
        if (!nome || nome.length < 2) continue;
        if (knownNamesUpper.has(nome)) continue;
        if (nome === acc.scene.set || nome === acc.scene.locacaoNome) continue;
        if (isPeriodoTextoReconhecido(nome)) continue;
        if (MONTAGEM_PATTERN.test(nome)) continue;
        const isPerson =
          PERSON_DESCRIPTOR_PATTERN.test(after) ||
          REFLEXIVE_VERB_FOLLOWS_PATTERN.test(after) ||
          PERCEPTION_VERB_PRECEDES_PATTERN.test(before);
        if (!isPerson) continue;
        knownNamesUpper.add(nome);
        semFalaAqui.add(nome);
      }
    }

    acc.scene.personagens = [...new Set([...acc.personagensComFala, ...semFalaAqui])];
    acc.scene.personagensSemFala = [...semFalaAqui];
  }

  const scenes = accumulators.map((a) => a.scene);

  // Ordem do documento importa pra herança (cena N pode herdar de N-1) — roda antes de contar
  // os avisos, senão "sem herança" contaria cenas que a própria herança já resolveu.
  const semHeranca = applyClasseLuzInheritance(scenes);

  const avisos: string[] = [];
  const semPeriodo = scenes.filter((s) => s.periodo == null).length;
  const naoReconhecidas = scenes.filter((s) => s.periodo != null && !isPeriodoTextoReconhecido(s.periodo)).length;
  const semNumero = scenes.filter((s) => s.numeroGerado).length;
  const semFalaTotal = scenes.reduce((sum, s) => sum + (s.personagensSemFala?.length ?? 0), 0);
  if (semPeriodo > 0) avisos.push(`${semPeriodo} cenas sem período reconhecido`);
  if (naoReconhecidas > 0)
    avisos.push(`${naoReconhecidas} cenas com período não reconhecido — confira classificação dia/noite`);
  if (semHeranca > 0)
    avisos.push(`${semHeranca} cenas sem período determinável (ex.: 1ª cena do roteiro é "contínuo") — revise manualmente`);
  if (semNumero > 0) avisos.push(`${semNumero} cenas sem número reconhecido no PDF`);
  if (semFalaTotal > 0) avisos.push(`${semFalaTotal} personagens detectados sem fala — revise antes de confirmar`);

  const sugestoesFusao = detectSetFusionSuggestions(scenes);

  return { scenes, avisos, sugestoesFusao };
}
