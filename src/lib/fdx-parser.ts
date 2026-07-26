/**
 * Parser de roteiro no formato Final Draft (.fdx, um XML).
 *
 * Aceita tanto <Scene><Paragraph>...</Paragraph></Scene> quanto a estrutura mais comum
 * de exportação real do Final Draft, uma lista plana de <Paragraph> soltos sob <Content>
 * — nesse caso as cenas são inferidas pelas fronteiras de "Scene Heading".
 */
import { XMLParser } from "fast-xml-parser";

import { suggestTempoEstimadoMin } from "@/lib/paginas";

export type FdxPeriodo = "DIA" | "NOITE" | "ENTARDECER" | "AMANHECER" | "CONTINUO" | "DEPOIS";

export type FdxScene = {
  numero: string;
  // true quando não foi possível extrair um número real da fonte (rótulo "CENA N"/atributo
  // Number do FDX) e a numeração sequencial (1, 2, 3...) foi usada como último recurso.
  numeroGerado: boolean;
  // null = não detectado no heading — o roteiro não segue o padrão "INT./EXT. ..." ou o
  // cabeçalho não tem período reconhecível. O usuário preenche depois; nunca inventamos um
  // valor (ex.: não presumimos INT nem DIA como default).
  tipo: "INT" | "EXT" | null;
  periodo: FdxPeriodo | null;
  set: string | null;
  sinopse: string | null;
  personagens: string[];
  paginas: number;
  tempoEstimadoMinSugerido: number;
};

export type FdxParseResult = {
  scenes: FdxScene[];
  // Mensagens prontas para exibir no preview de importação — vazio quando o roteiro não
  // apresentou nenhuma irregularidade de formatação.
  avisos: string[];
};

const PERIODO_MAP: Record<string, FdxPeriodo> = {
  DIA: "DIA",
  DAY: "DIA",
  TARDE: "DIA",
  NOITE: "NOITE",
  NIGHT: "NOITE",
  ENTARDECER: "ENTARDECER",
  DUSK: "ENTARDECER",
  AMANHECER: "AMANHECER",
  DAWN: "AMANHECER",
  CONTINUO: "CONTINUO",
  CONTÍNUO: "CONTINUO",
  CONTINUOUS: "CONTINUO",
  DEPOIS: "DEPOIS",
  LATER: "DEPOIS",
};

// Algumas exportações do Final Draft (ex.: roteiros escritos com um rótulo de cena separado
// do cabeçalho técnico) usam um Scene Heading "CENA N:"/"Cena N: <descrição>" só como rótulo,
// seguido por um SEGUNDO Scene Heading com o cabeçalho real "INT./EXT. LOCAL - PERÍODO". Um
// heading real também pode vir prefixado com "Insert N - " (sub-plano dentro de uma cena de
// passagem de tempo/montagem) — nesse caso o prefixo não faz parte do local.
const SCENE_LABEL_PATTERN = /^CENA\s+([^\s:]+)/i;
const INSERT_PREFIX_PATTERN = /^insert\s*\d+\s*[-–]\s*/i;
// Roteiros independentes nem sempre têm um cabeçalho técnico "INT./EXT." — um Scene Heading
// pode ser só "LOCAL - PERÍODO". Por isso "cabeçalho real" (o suficiente pra abrir uma cena
// dentro de um bloco "CENA N") exige apenas o prefixo INT/EXT quando ele existe; quando não
// existe, o heading ainda é tratado como cabeçalho de cena (só que sem tipo detectado).
const TIPO_PREFIX_PATTERN = /^(?:INT|EXT|I\/E|E\/I)(?:[\s./]*(?:INT|EXT))?[.\s]+/i;
// Aceita " - ", " – ", " — " e " / " como separador entre local e período (e entre níveis de
// sublocalização) — sempre com espaço dos dois lados, pra não confundir com hífen/barra que
// façam parte do próprio nome do local.
const LOCAL_PERIODO_SEPARATOR = /\s+(?:[-–—]|\/)\s+/g;

function stripInsertPrefix(text: string): string {
  return text.replace(INSERT_PREFIX_PATTERN, "");
}

function isRealHeadingText(text: string): boolean {
  return TIPO_PREFIX_PATTERN.test(stripInsertPrefix(text));
}

const ACTION_CHARS_PER_LINE = 60;
const DIALOGUE_CHARS_PER_LINE = 35;
const LINES_PER_EIGHTH = 7;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

type FdxNode = Record<string, unknown>;

function paragraphType(paragraph: FdxNode): string {
  return String(paragraph["@_Type"] ?? "");
}

function paragraphText(paragraph: FdxNode): string {
  return asArray(paragraph.Text as FdxNode | FdxNode[])
    .map((t) => (typeof t === "string" ? t : String((t as FdxNode)?.["#text"] ?? "")))
    .join("")
    .trim();
}

function normalizeCharacterName(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseHeading(raw: string): { tipo: FdxScene["tipo"]; set: string | null; periodo: FdxScene["periodo"] } {
  const heading = stripInsertPrefix(raw.trim());
  if (!heading) return { tipo: null, set: null, periodo: null };

  const hasTipoPrefix = TIPO_PREFIX_PATTERN.test(heading);
  const tipo: FdxScene["tipo"] = hasTipoPrefix ? (/^EXT/i.test(heading) ? "EXT" : "INT") : null;
  const body = (hasTipoPrefix ? heading.replace(TIPO_PREFIX_PATTERN, "") : heading).trim() || heading;

  // Só divide em local/período no ÚLTIMO separador — e só se o texto depois dele for um
  // período reconhecido. Sublocalização ("APTO - BANHEIRO - NOITE") tem mais de um separador,
  // mas o local ainda é "tudo antes do último"; se o que vem depois do último separador não
  // bater com nenhum período (ex.: o hífen faz parte do próprio nome do local), não dividimos
  // nada — o texto inteiro vira local e o período fica em branco, em vez de cortar errado.
  const matches = [...body.matchAll(LOCAL_PERIODO_SEPARATOR)];
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const lastIndex = last.index ?? 0;
    const before = body.slice(0, lastIndex).trim();
    const after = body.slice(lastIndex + last[0].length).trim();
    const periodo = PERIODO_MAP[after.toUpperCase()];
    if (periodo) {
      return { tipo, set: before || null, periodo };
    }
  }

  return { tipo, set: body || null, periodo: null };
}

// O rótulo "quem está na cena" que o roteirista marca manualmente no Scene Heading
// (SceneProperties > SceneArcBeats > CharacterArcBeat) é uma segunda fonte de elenco,
// distinta dos parágrafos Type="Character" (que só capturam quem tem fala) — um figurante
// mudo tageado ali não teria outra forma de aparecer na lista de personagens da cena.
function characterArcBeatNames(paragraph: FdxNode): string[] {
  const sceneProperties = paragraph.SceneProperties as FdxNode | undefined;
  const arcBeats = sceneProperties?.SceneArcBeats;
  if (!arcBeats || typeof arcBeats === "string") return [];
  return asArray((arcBeats as FdxNode).CharacterArcBeat as FdxNode | FdxNode[])
    .map((beat) => String((beat as FdxNode)["@_Name"] ?? "").trim())
    .filter((name) => name.length > 0);
}

function countLinhas(paragraphs: FdxNode[]): number {
  let linhas = 0;
  for (const p of paragraphs) {
    const text = paragraphText(p);
    if (!text) continue;
    const type = paragraphType(p);
    const charsPerLine = type === "Dialogue" ? DIALOGUE_CHARS_PER_LINE : ACTION_CHARS_PER_LINE;
    linhas += Math.max(1, Math.ceil(text.length / charsPerLine));
  }
  return linhas;
}

function buildScene(numero: string, numeroGerado: boolean, paragraphs: FdxNode[]): FdxScene {
  const heading = paragraphs.find((p) => paragraphType(p) === "Scene Heading");
  const { tipo, set, periodo } = parseHeading(heading ? paragraphText(heading) : "");

  const actionParagraphs = paragraphs.filter((p) => paragraphType(p) === "Action");
  const dialogueParagraphs = paragraphs.filter((p) => paragraphType(p) === "Dialogue");
  const characterParagraphs = paragraphs.filter((p) => paragraphType(p) === "Character");

  const firstAction = actionParagraphs.length > 0 ? paragraphText(actionParagraphs[0]) : "";
  const sinopse = firstAction ? (firstAction.length > 200 ? `${firstAction.slice(0, 200).trimEnd()}…` : firstAction) : null;

  const linhas = countLinhas([...actionParagraphs, ...dialogueParagraphs]);
  const eighths = Math.max(1, Math.round(linhas / LINES_PER_EIGHTH));
  const paginas = eighths / 8;

  const personagens = [
    ...new Set(
      [
        ...characterParagraphs.map((p) => paragraphText(p)),
        ...(heading ? characterArcBeatNames(heading) : []),
      ]
        .map(normalizeCharacterName)
        .filter((name) => name.length > 0)
    ),
  ];

  return {
    numero,
    numeroGerado,
    tipo,
    periodo,
    set,
    sinopse,
    personagens,
    paginas,
    tempoEstimadoMinSugerido: suggestTempoEstimadoMin(paginas),
  };
}

type SceneGroup = { numero: string | null; paragraphs: FdxNode[] };

function extractSceneGroups(content: FdxNode): { groups: SceneGroup[]; semHeadingDetectado: boolean } {
  const sceneNodes = asArray(content.Scene as FdxNode | FdxNode[]);
  if (sceneNodes.length > 0) {
    const groups = sceneNodes.map((scene) => ({
      numero: scene["@_Number"] != null ? String(scene["@_Number"]) : null,
      paragraphs: asArray(scene.Paragraph as FdxNode | FdxNode[]),
    }));
    return { groups, semHeadingDetectado: false };
  }

  // Exportação real do Final Draft: <Paragraph> soltos sob <Content>, sem <Scene> agrupando.
  // No caso comum, cada "Scene Heading" (já um cabeçalho real "INT./EXT. ...") marca o início
  // de uma nova cena. Alguns roteiros usam um Scene Heading "CENA N:" só como rótulo antes do
  // cabeçalho real (ver comentário do SCENE_LABEL_PATTERN) — nesse caso o rótulo abre a cena
  // (e fornece o número), o PRIMEIRO cabeçalho real que vier a seguir fornece tipo/local/período,
  // e qualquer "Insert N - ..." adicional dentro do mesmo rótulo (sub-planos de uma cena de
  // passagem de tempo/montagem) é absorvido no conteúdo da mesma cena em vez de virar uma cena
  // nova. Scene Headings sem texto (linhas em branco formatadas como heading) são ignorados.
  const flatParagraphs = asArray(content.Paragraph as FdxNode | FdxNode[]);
  const groups: SceneGroup[] = [];
  let current: FdxNode[] | null = null;
  let currentHasRealHeading = false;
  let currentOpenedByLabel = false;

  for (const paragraph of flatParagraphs) {
    if (paragraphType(paragraph) === "Scene Heading") {
      const text = paragraphText(paragraph);
      if (!text) continue;

      const labelMatch = text.match(SCENE_LABEL_PATTERN);
      if (labelMatch) {
        current = [];
        groups.push({ numero: labelMatch[1], paragraphs: current });
        currentHasRealHeading = false;
        currentOpenedByLabel = true;
        continue;
      }

      if (isRealHeadingText(text)) {
        if (currentOpenedByLabel && !currentHasRealHeading) {
          current?.push(paragraph);
          currentHasRealHeading = true;
        } else if (currentOpenedByLabel && currentHasRealHeading) {
          // Insert adicional dentro do mesmo rótulo de cena — não abre cena nova nem
          // substitui o cabeçalho já capturado.
        } else {
          current = [];
          groups.push({ numero: null, paragraphs: current });
          current.push(paragraph);
          currentHasRealHeading = true;
          currentOpenedByLabel = false;
        }
        continue;
      }

      // Scene Heading que não é nem rótulo "CENA N" nem um cabeçalho INT/EXT reconhecível —
      // mantém o comportamento original (abre uma cena nova) em vez de descartar o texto.
      current = [];
      groups.push({ numero: null, paragraphs: current });
      current.push(paragraph);
      currentHasRealHeading = true;
      currentOpenedByLabel = false;
      continue;
    }

    current?.push(paragraph);
  }

  // Nenhum Scene Heading em lugar nenhum — não dá pra inferir cena alguma. O roteiro inteiro
  // vira uma única cena "sem cabeçalho" em vez de sumir da importação silenciosamente.
  if (groups.length === 0 && flatParagraphs.length > 0) {
    return { groups: [{ numero: null, paragraphs: flatParagraphs }], semHeadingDetectado: true };
  }

  return { groups, semHeadingDetectado: false };
}

export function parseFdx(xml: string): FdxParseResult {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(xml) as FdxNode;
  const root = (doc.FinalDraft as FdxNode) ?? doc;
  const content = root?.Content as FdxNode | undefined;
  if (!content) return { scenes: [], avisos: [] };

  const { groups, semHeadingDetectado } = extractSceneGroups(content);
  const scenes = groups.map((group, index) => {
    const numeroGerado = group.numero == null;
    return buildScene(group.numero ?? String(index + 1), numeroGerado, group.paragraphs);
  });

  const avisos: string[] = [];
  if (semHeadingDetectado) {
    avisos.push(
      "Nenhum cabeçalho de cena encontrado. O roteiro pode não estar formatado em Master Scenes. Verifique a formatação no Final Draft."
    );
  } else {
    const semTipo = scenes.filter((s) => s.tipo == null).length;
    const semPeriodo = scenes.filter((s) => s.periodo == null).length;
    const numerosGerados = scenes.filter((s) => s.numeroGerado).length;
    if (semTipo > 0) avisos.push(`${semTipo} cenas sem cabeçalho INT/EXT detectado`);
    if (semPeriodo > 0) avisos.push(`${semPeriodo} cenas sem período (Dia/Noite) detectado`);
    if (numerosGerados > 0) avisos.push("Numeração de cenas gerada automaticamente");
  }

  return { scenes, avisos };
}

// ---------------------------------------------------------------------------
// TitlePage — metadados do roteiro (título, roteiristas, draft, contato)
// ---------------------------------------------------------------------------

export type FdxTitlePage = {
  tituloSugerido: string | null;
  roteiristas: string | null;
  numeroDraft: string | null;
  dataDraft: string | null;
  contatoProducao: string | null;
};

const EMPTY_TITLE_PAGE: FdxTitlePage = {
  tituloSugerido: null,
  roteiristas: null,
  numeroDraft: null,
  dataDraft: null,
  contatoProducao: null,
};

// O TitlePage do Final Draft é texto livre digitado pelo usuário (diferente do roteiro em
// si, que tem tipos de parágrafo bem definidos como "Scene Heading"/"Action"/"Character").
// Não há um schema confiável para "isto é o autor" vs "isto é a data do draft", então
// extraímos heuristicamente por padrões de texto comuns — o usuário revisa/corrige no wizard.
const DATE_PATTERN =
  /\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b|\b(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)\.?\s+\d{1,2}.{0,4}\d{2,4}|\b\d{4}\b/i;
const WRITTEN_BY_PATTERN = /^(written|escrito|roteiro)\s+(by|por)$|^by$|^por$/i;
const DRAFT_PATTERN = /draft|versão|rascunho/i;
const CONTACT_PATTERN = /^contac?t|^contato/i;

function titlePageParagraphs(xml: string): { texto: string; tipo: string }[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(xml) as FdxNode;
  const root = (doc.FinalDraft as FdxNode) ?? doc;
  const titlePage = root?.TitlePage as FdxNode | undefined;
  const content = titlePage?.Content as FdxNode | undefined;
  if (!content) return [];
  return asArray(content.Paragraph as FdxNode | FdxNode[]).map((p) => ({
    texto: paragraphText(p),
    tipo: paragraphType(p),
  }));
}

export function parseFdxTitlePage(xml: string): FdxTitlePage {
  const paragraphs = titlePageParagraphs(xml);
  if (paragraphs.length === 0) return EMPTY_TITLE_PAGE;
  const lines = paragraphs.map((p) => p.texto);

  const tituloSugerido = lines.find((l) => l.length > 0) ?? null;

  let roteiristas: string | null = null;
  const writtenByIndex = lines.findIndex((l) => WRITTEN_BY_PATTERN.test(l.trim()));
  if (writtenByIndex >= 0) {
    const names: string[] = [];
    for (let i = writtenByIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) break;
      if (DRAFT_PATTERN.test(line) || CONTACT_PATTERN.test(line)) break;
      names.push(line);
    }
    roteiristas = names.length > 0 ? names.join(", ") : null;
  }
  if (!roteiristas) {
    // Sem uma linha "Written by" pra ancorar — recorre ao atributo Type="Author" do FDX.
    const authorLines = paragraphs
      .filter((p) => /author/i.test(p.tipo) && p.texto.trim().length > 0 && !WRITTEN_BY_PATTERN.test(p.texto.trim()))
      .map((p) => p.texto.trim());
    roteiristas = authorLines.length > 0 ? authorLines.join(", ") : null;
  }

  let numeroDraft: string | null = null;
  let dataDraft: string | null = null;
  const draftLine = lines.find((l) => DRAFT_PATTERN.test(l));
  if (draftLine) {
    const dateMatch = draftLine.match(DATE_PATTERN);
    if (dateMatch) {
      dataDraft = dateMatch[0].trim();
      const rest = draftLine.replace(dateMatch[0], "").replace(/[\s\-–,]+$/, "").replace(/^[\s\-–,]+/, "").trim();
      numeroDraft = rest.length > 0 ? rest : null;
    } else {
      numeroDraft = draftLine.trim();
    }
  }
  if (!dataDraft) {
    const dateOnlyLine = lines.find((l) => DATE_PATTERN.test(l) && !DRAFT_PATTERN.test(l));
    if (dateOnlyLine) dataDraft = dateOnlyLine.match(DATE_PATTERN)![0].trim();
  }

  let contatoProducao: string | null = null;
  const contactIndex = lines.findIndex((l) => CONTACT_PATTERN.test(l.trim()));
  if (contactIndex >= 0) {
    const afterLabel = lines[contactIndex].replace(CONTACT_PATTERN, "").replace(/^[:\s]+/, "").trim();
    const rest = lines
      .slice(contactIndex + 1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const combined = [afterLabel, ...rest].filter((l) => l.length > 0);
    contatoProducao = combined.length > 0 ? combined.join("\n") : null;
  }

  return { tituloSugerido, roteiristas, numeroDraft, dataDraft, contatoProducao };
}
