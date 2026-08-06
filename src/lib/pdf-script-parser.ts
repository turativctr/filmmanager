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
import { normalizeCharacterName, PERIODO_MAP } from "@/lib/fdx-parser";

import type { FdxParseResult, FdxScene } from "@/lib/fdx-parser";

export class PdfScriptStructureError extends Error {}

const UNRECOGNIZED_STRUCTURE_MESSAGE =
  "Não foi possível reconhecer a estrutura deste PDF. Ele pode ser um documento escaneado ou não seguir a formatação padrão de roteiro. Envie um arquivo .fdx ou .wdz.";

// Abaixo desse total de caracteres extraídos do documento inteiro, tratamos como PDF escaneado
// (imagem sem camada de texto) — não tentamos OCR, só recusamos com mensagem clara.
const MIN_TOTAL_CHARS = 50;

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

type RawItem = { text: string; x0: number; x1: number };
type Line = { page: number; y: number; items: RawItem[]; text: string };

async function extractLines(buffer: Buffer): Promise<{ lines: Line[]; pageWidth: number; pageHeight: number }[]> {
  // Import dinâmico: pdfjs-dist só roda no runtime Node do servidor (ver next.config.mjs —
  // precisou virar serverExternalPackages pra webpack não quebrar a resolução do worker).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;

  const pages: { lines: Line[]; pageWidth: number; pageHeight: number }[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const byY = new Map<number, RawItem[]>();
    for (const raw of content.items) {
      const item = raw as { str: string; transform: number[]; width?: number };
      if (!item.str) continue;
      const y = Math.round(item.transform[5] * 2) / 2;
      const entry: RawItem = { text: item.str, x0: item.transform[4], x1: item.transform[4] + (item.width ?? 0) };
      const bucket = byY.get(y);
      if (bucket) bucket.push(entry);
      else byY.set(y, [entry]);
    }

    const lines: Line[] = [...byY.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, items]) => {
        const sorted = [...items].sort((a, b) => a.x0 - b.x0);
        return { page: pageNumber, y, items: sorted, text: sorted.map((i) => i.text).join("").trim() };
      })
      .filter((line) => line.text.length > 0);

    pages.push({ lines, pageWidth: viewport.width, pageHeight: viewport.height });
  }
  return pages;
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
  periodo: FdxScene["periodo"];
} {
  const hasTipoPrefix = TIPO_PREFIX_PATTERN.test(raw);
  const tipo: FdxScene["tipo"] = hasTipoPrefix ? (/^EXT/i.test(raw) ? "EXT" : "INT") : null;
  const body = (hasTipoPrefix ? raw.replace(TIPO_PREFIX_PATTERN, "") : raw).trim() || raw;

  let local = body;
  let periodo: FdxScene["periodo"] = null;
  const matches = [...body.matchAll(LOCAL_PERIODO_SEPARATOR)];
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const before = body.slice(0, last.index ?? 0).trim();
    const after = body.slice((last.index ?? 0) + last[0].length).trim();
    const mapped = PERIODO_MAP[after.toUpperCase()];
    if (mapped) {
      local = before;
      periodo = mapped;
    }
  }

  // Convenção "LOCAL; SET" (ver comentário no topo do arquivo e em locacao-import.ts) — o que
  // vem antes do ";" agrupa vários sets na MESMA Locacao; sem ";", locação e set são o mesmo
  // valor (igual ao comportamento de sempre do import de .fdx).
  const semicolon = local.indexOf(";");
  const locacaoNome = semicolon >= 0 ? local.slice(0, semicolon).trim().toUpperCase() || null : null;
  const set = (semicolon >= 0 ? local.slice(semicolon + 1).trim() : local).toUpperCase() || null;

  return { tipo, set, locacaoNome: locacaoNome ?? set, periodo };
}

// Uma cena que atravessa de um período pro outro (ex.: "NOITE PARA DIA") tem consequência real de
// produção — luz de dois momentos distintos — e precisa aparecer distinta de DIA/NOITE simples.
// A checagem acima já cobre isso: "NOITE PARA DIA"/"DIA PARA NOITE" são chaves normais do
// PERIODO_MAP (ver fdx-parser.ts), então caem no mesmo caminho de split-por-separador.

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

export async function parsePdfScript(buffer: Buffer): Promise<FdxParseResult> {
  const pages = await extractLines(buffer);
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
          const { tipo, set, locacaoNome, periodo } = parseHeadingBody(text);
          const numero = leftNumber ?? rightNumber;
          sequencial += 1;
          accumulators.push({
            scene: {
              numero: numero ?? String(sequencial),
              numeroGerado: numero == null,
              tipo,
              periodo,
              set,
              locacaoNome,
              sinopse: null,
              personagens: [],
              personagensSemFala: [],
              paginas: 0,
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

  // Oitavos pela ALTURA ocupada — não pela contagem de linhas como no .fdx (aqui temos geometria
  // de verdade). Página padrão de roteiro em Letter usa margem de 1" topo/rodapé; isso é formato
  // físico de página (constante), diferente das margens de ELEMENTO que descobrimos acima.
  const pageHeight = pages[0].pageHeight;
  const PAGE_TOP = pageHeight - 72;
  const PAGE_BOTTOM = 72;
  const USABLE_HEIGHT = PAGE_TOP - PAGE_BOTTOM;
  const EIGHTH_HEIGHT = USABLE_HEIGHT / 8;
  function position(pageNumber: number, y: number) {
    return (pageNumber - 1) * USABLE_HEIGHT + (PAGE_TOP - y);
  }
  const lastLine = pages[pages.length - 1].lines[pages[pages.length - 1].lines.length - 1];
  const docEndPosition = lastLine ? position(lastLine.page, lastLine.y) : position(pages.length, PAGE_BOTTOM);

  for (let i = 0; i < accumulators.length; i++) {
    const acc = accumulators[i];
    const next = accumulators[i + 1];
    const startPos = position(acc.startPage, acc.startY);
    const endPos = next ? position(next.startPage, next.startY) : docEndPosition;
    const eighths = Math.max(1, Math.round((endPos - startPos) / EIGHTH_HEIGHT));
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
        if (PERIODO_MAP[nome]) continue;
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
  const avisos: string[] = [];
  const semPeriodo = scenes.filter((s) => s.periodo == null).length;
  const semNumero = scenes.filter((s) => s.numeroGerado).length;
  const semFalaTotal = scenes.reduce((sum, s) => sum + (s.personagensSemFala?.length ?? 0), 0);
  if (semPeriodo > 0) avisos.push(`${semPeriodo} cenas sem período reconhecido`);
  if (semNumero > 0) avisos.push(`${semNumero} cenas sem número reconhecido no PDF`);
  if (semFalaTotal > 0) avisos.push(`${semFalaTotal} personagens detectados sem fala — revise antes de confirmar`);

  return { scenes, avisos };
}
