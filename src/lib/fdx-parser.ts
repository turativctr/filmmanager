/**
 * Parser de roteiro no formato Final Draft (.fdx, um XML).
 *
 * Aceita tanto <Scene><Paragraph>...</Paragraph></Scene> quanto a estrutura mais comum
 * de exportação real do Final Draft, uma lista plana de <Paragraph> soltos sob <Content>
 * — nesse caso as cenas são inferidas pelas fronteiras de "Scene Heading".
 */
import { XMLParser } from "fast-xml-parser";

import { suggestTempoEstimadoMin } from "@/lib/paginas";

// Deixou de ser enum fechado — roteiro brasileiro usa MADRUGADA, AMANHECER, ENTARDECER,
// CREPÚSCULO, PÔR DO SOL, MAGIC HOUR, ALVORADA, "X PARA Y" e qualquer outra combinação que o
// roteirista escrever; uma lista fechada quebra no próximo roteiro. `periodo` guarda o texto
// exatamente como apareceu no cabeçalho (só maiúscula); `classeLuz` é o que é FECHADO e
// derivado dele (ver deriveClasseLuz) — é o que stripboard/DOOD/ordem de diária consultam.
export type ClasseLuz = "DIA" | "NOITE" | "TRANSICAO" | "INDEFINIDO";

export type FdxScene = {
  numero: string;
  // true quando não foi possível extrair um número real da fonte (rótulo "CENA N"/atributo
  // Number do FDX) e a numeração sequencial (1, 2, 3...) foi usada como último recurso.
  numeroGerado: boolean;
  // null = não detectado no heading — o roteiro não segue o padrão "INT./EXT. ..." O usuário
  // preenche depois; nunca inventamos um valor (ex.: não presumimos INT como default).
  tipo: "INT" | "EXT" | null;
  // Texto livre, exatamente como apareceu depois do último separador do cabeçalho (maiúscula) —
  // ver parseHeading. null só quando o cabeçalho não tinha separador nenhum pra cortar; NUNCA
  // null por "não reconhecer" a palavra (isso vira classeLuz=INDEFINIDO, preservando o texto).
  periodo: string | null;
  // Só populado quando `periodo` é uma transição "X PARA Y" — a ponta final (Y), maiúscula. Ver
  // deriveClasseLuz e a herança de classeLuz em cenas CONTÍNUO/INDEFINIDO.
  periodoFim: string | null;
  // Derivado de `periodo` (nunca digitado à mão) — o que alimenta cor de tira no stripboard,
  // DOOD e ordem de diária. Ver deriveClasseLuz e applyClasseLuzInheritance.
  classeLuz: ClasseLuz;
  set: string | null;
  // Nome da locação (agrupador) — sempre populado por ambos os parsers agora. Convenção "LOCAL;
  // SET" no cabeçalho: o que vem antes do ";" agrupa vários `set` na MESMA Locacao (ver
  // resolveLocacaoId nas rotas de import); sem ";", locação e set são o mesmo valor.
  locacaoNome: string | null;
  sinopse: string | null;
  personagens: string[];
  // Subconjunto de `personagens` detectado só pela heurística de primeira menção em maiúscula
  // na ação (não tem parágrafo Character/fala) — só populado pelo parser de PDF. A prévia marca
  // esses como descartáveis antes de confirmar, já que a heurística pode errar.
  personagensSemFala?: string[];
  paginas: number;
  // Linhas brutas contadas na importação — o dado de origem por trás de `paginas` (ver
  // countLinhasSimulado aqui e o cálculo geométrico em pdf-script-parser.ts). Guardado em Scene
  // pra permitir recalcular oitavos sem reimportar, se a regra de contagem mudar de novo.
  linhas: number;
  tempoEstimadoMinSugerido: number;
};

// Sugestão de unificação de sets homônimos (ex.: "QUARTO DOS PAIS" aparece solto E dentro de
// "CASA") — NUNCA aplicada sozinha, só oferecida na prévia de importação pro AD confirmar. Ver
// detectSetFusionSuggestions.
export type FusionSuggestion = {
  // Nome do set em comum (grafia da primeira ocorrência solta), normalizado só pra comparação —
  // exibido com a grafia original.
  set: string;
  cenasSolto: string[];
  aninhadoEm: { locacaoNome: string; cenas: string[] }[];
};

export type FdxParseResult = {
  scenes: FdxScene[];
  // Mensagens prontas para exibir no preview de importação — vazio quando o roteiro não
  // apresentou nenhuma irregularidade de formatação.
  avisos: string[];
  sugestoesFusao: FusionSuggestion[];
};

// Palavras reconhecidas — mas NUNCA uma lista fechada pro campo `periodo` em si (ver o comentário
// no topo do arquivo): serve só pra DERIVAR `classeLuz`. Texto não listado aqui é preservado tal
// qual em `periodo`, vira classeLuz=INDEFINIDO (herda da cena anterior) e soma no aviso de
// "período não reconhecido" — nunca é rejeitado nem reescrito.
const DIA_WORDS = new Set(["DIA", "MANHA", "MANHÃ", "TARDE", "DAY", "MORNING", "AFTERNOON"]);
// MADRUGADA é NOITE pra fins de luz (é o gaffer que consulta classeLuz) mas continua "MADRUGADA"
// no texto (é a AD que precisa da distinção pra chamada) — ver o comentário de `periodo` acima.
const NOITE_WORDS = new Set([
  "NOITE",
  "MADRUGADA",
  "NIGHT",
  "DAWN",
  "AMANHECER",
  "ALVORADA",
  "DUSK",
  "ENTARDECER",
  "CREPUSCULO",
  "CREPÚSCULO",
  "POR DO SOL",
  "PÔR DO SOL",
  "ANOITECER",
  "MAGIC HOUR",
]);
// Cenas que continuam a anterior sem período próprio — resolvidas por herança (ver
// applyClasseLuzInheritance), nunca por si mesmas. DEPOIS/LATER mantém a semântica do antigo
// enum (cena adiante no tempo, sem período determinado) sob a mesma regra de herança.
const INDEFINIDO_WORDS = new Set([
  "CONTINUO",
  "CONTÍNUO",
  "CONTINUA",
  "CONTÍNUA",
  "CONTINUOUS",
  "MOMENTOS DEPOIS",
  "DEPOIS",
  "LATER",
]);
const TRANSICAO_PATTERN = /^(.+?)\s+PARA\s+(.+)$/i;

function classifyPeriodoWord(texto: string): "DIA" | "NOITE" | "INDEFINIDO" | null {
  const upper = texto.trim().toUpperCase();
  if (DIA_WORDS.has(upper)) return "DIA";
  if (NOITE_WORDS.has(upper)) return "NOITE";
  if (INDEFINIDO_WORDS.has(upper)) return "INDEFINIDO";
  return null;
}

/** Deriva classeLuz (fechado, o que stripboard/DOOD/ordem de diária consultam) a partir do texto
 *  livre de período. "X PARA Y" é sempre TRANSICAO, mesmo que X/Y não sejam palavras reconhecidas
 *  (guarda os dois lados; deriveClasseLuz(periodoFim) resolve a ponta final na herança). Texto que
 *  não é transição nem está nas listas acima cai em INDEFINIDO igual a CONTÍNUO — a diferença entre
 *  "contínuo esperado" e "palavra não reconhecida" só importa pro aviso de revisão, não pro cálculo
 *  em si (ver isPeriodoTextoReconhecido). */
export function deriveClasseLuz(periodoTexto: string | null): { classeLuz: ClasseLuz; periodoFim: string | null } {
  if (!periodoTexto) return { classeLuz: "INDEFINIDO", periodoFim: null };
  const texto = periodoTexto.trim().toUpperCase();
  const transicao = texto.match(TRANSICAO_PATTERN);
  if (transicao) return { classeLuz: "TRANSICAO", periodoFim: transicao[2].trim() };
  const classified = classifyPeriodoWord(texto);
  if (classified === "DIA" || classified === "NOITE") return { classeLuz: classified, periodoFim: null };
  return { classeLuz: "INDEFINIDO", periodoFim: null };
}

export function isPeriodoTextoReconhecido(texto: string): boolean {
  return TRANSICAO_PATTERN.test(texto) || classifyPeriodoWord(texto) !== null;
}

/** Passe sequencial (ordem do roteiro importa) que resolve classeLuz das cenas INDEFINIDO por
 *  herança da cena anterior JÁ RESOLVIDA — ver o pedido original pra o raciocínio completo.
 *  Regra chave: quando a cena anterior é TRANSICAO, herda-se a PONTA FINAL (periodoFim), não a
 *  inicial (cena 13 termina em MADRUGADA → cena 14 herda NOITE, não o NOITE do início da 13).
 *  Cena INDEFINIDO que não achou o que herdar (primeira cena do roteiro, ou cadeia de herança
 *  quebrada) fica INDEFINIDO mesmo e conta no aviso de revisão — nunca inventa um valor. */
export function applyClasseLuzInheritance(scenes: Pick<FdxScene, "classeLuz" | "periodoFim">[]): number {
  let lastResolved: ClasseLuz | null = null;
  let lastPeriodoFim: string | null = null;
  let semHeranca = 0;

  for (const scene of scenes) {
    if (scene.classeLuz === "INDEFINIDO") {
      if (lastResolved === "TRANSICAO" && lastPeriodoFim) {
        const { classeLuz: fimClasse } = deriveClasseLuz(lastPeriodoFim);
        if (fimClasse === "DIA" || fimClasse === "NOITE") {
          scene.classeLuz = fimClasse;
        } else {
          semHeranca += 1;
        }
      } else if (lastResolved === "DIA" || lastResolved === "NOITE") {
        scene.classeLuz = lastResolved;
      } else {
        semHeranca += 1;
      }
    }

    // Só avança o estado de rastreamento com uma classe JÁ RESOLVIDA — uma cena que ficou
    // INDEFINIDO por falta de herança não deve propagar esse "vazio" adiante como se fosse um
    // valor válido pra próxima cena herdar.
    if (scene.classeLuz !== "INDEFINIDO") {
      lastResolved = scene.classeLuz;
      lastPeriodoFim = scene.classeLuz === "TRANSICAO" ? scene.periodoFim : null;
    }
  }

  return semHeranca;
}

/** Normaliza nome de set/locação SÓ pra comparação de fusão — maiúscula, sem acento, espaço
 *  colapsado. Mesmo padrão de normalizeEndereco (src/lib/locacao.ts), propositalmente sem
 *  similaridade difusa: um falso positivo aqui funde dois sets errados e corrompe a decupagem. */
function normalizeForFusion(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Detecta sets que aparecem TANTO soltos (sem locação-pai distinta) QUANTO aninhados dentro de
 *  outra locação — ex.: "QUARTO DOS PAIS" batendo cena a cena ora sozinho, ora dentro de "CASA".
 *  Só SUGERE (retorna a lista pro AD revisar); nunca decide nem reescreve nada aqui. */
export function detectSetFusionSuggestions(
  scenes: Pick<FdxScene, "numero" | "set" | "locacaoNome">[]
): FusionSuggestion[] {
  const standalone = new Map<string, { display: string; cenas: string[] }>();
  const nested = new Map<string, Map<string, { display: string; cenas: string[] }>>();

  for (const scene of scenes) {
    if (!scene.set) continue;
    const normalizedSet = normalizeForFusion(scene.set);
    const isStandalone = !scene.locacaoNome || normalizeForFusion(scene.locacaoNome) === normalizedSet;
    if (isStandalone) {
      const entry = standalone.get(normalizedSet) ?? { display: scene.set, cenas: [] };
      entry.cenas.push(scene.numero);
      standalone.set(normalizedSet, entry);
    } else {
      const byLocacao = nested.get(normalizedSet) ?? new Map<string, { display: string; cenas: string[] }>();
      const key = normalizeForFusion(scene.locacaoNome as string);
      const entry = byLocacao.get(key) ?? { display: scene.locacaoNome as string, cenas: [] };
      entry.cenas.push(scene.numero);
      byLocacao.set(key, entry);
      nested.set(normalizedSet, byLocacao);
    }
  }

  const suggestions: FusionSuggestion[] = [];
  for (const [normalizedSet, standaloneEntry] of standalone) {
    const nestedEntry = nested.get(normalizedSet);
    if (!nestedEntry || nestedEntry.size === 0) continue;
    suggestions.push({
      set: standaloneEntry.display,
      cenasSolto: standaloneEntry.cenas,
      aninhadoEm: [...nestedEntry.values()].map((v) => ({ locacaoNome: v.display, cenas: v.cenas })),
    });
  }
  return suggestions;
}

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

// Simula a quebra de linha do render em Courier 12 (a fonte monoespaçada padrão de roteiro) —
// não há geometria real num .fdx/.wdz (texto puro, sem coordenadas), então medimos por
// aproximação: largura útil em caracteres por tipo de parágrafo, mais a linha em branco que a
// formatação de roteiro insere ANTES de determinados tipos (nunca depois — Parenthetical/Dialogue
// colam direto no que vem antes). Calibrado contra um roteiro real exportado do Final Draft 12 —
// ver scripts/verify-eighths-fixture.ts e o fixture em scripts/fixtures/.
const CHARS_PER_LINE_BY_TYPE: Record<string, number> = {
  "Scene Heading": 60,
  Action: 60,
  Character: 33,
  Parenthetical: 25,
  Dialogue: 35,
};
// Tipos de parágrafo do Final Draft fora dessa lista (ex.: "Shot", "General") não têm largura
// calibrada — tratamos como Action (prosa comum), o fallback mais seguro.
const DEFAULT_CHARS_PER_LINE = CHARS_PER_LINE_BY_TYPE.Action;
const BLANK_LINE_BEFORE_TYPES = new Set(["Scene Heading", "Action", "Character", "Transition"]);
// Denominador do oitavo: CONVENÇÃO da indústria (Movie Magic Scheduling e afins não medem a
// página do arquivo — usam a página padrão), não uma medida do arquivo. Fixo e igual pra
// PDF, .fdx e .wdz — "quantas linhas cabem nesta página" (o que pdf-script-parser.ts mede de
// verdade, por arquivo) e "quantas linhas valem 1 oitavo" são perguntas diferentes; derivar a
// segunda da primeira foi a causa de um desvio real entre o valor medido e o valor de referência.
export const LINHAS_POR_PAGINA_PADRAO = 55;

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

export function normalizeCharacterName(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

type ParsedHeading = {
  tipo: FdxScene["tipo"];
  locacaoNome: string | null;
  set: string | null;
  periodo: string | null;
  periodoFim: string | null;
  classeLuz: ClasseLuz;
};

/** O que vem depois do ÚLTIMO separador é SEMPRE período — sem exceção, sem gate contra lista
 *  fechada (esse gate era o defeito: cabeçalho com período não reconhecido, ex. "MADRUGADA",
 *  ficava com o texto inteiro intacto, período incluso, virando uma locação nova a cada variação
 *  de período). Sublocalização ("APTO - BANHEIRO - NOITE") tem mais de um separador; o local ainda
 *  é "tudo antes do último". Período não reconhecido é preservado no texto e sinalizado pra
 *  revisão (ver isPeriodoTextoReconhecido) — nunca volta a fazer parte do nome do local. */
function splitLocalPeriodo(body: string): { local: string; periodoTexto: string | null } {
  const matches = [...body.matchAll(LOCAL_PERIODO_SEPARATOR)];
  if (matches.length === 0) return { local: body, periodoTexto: null };
  const last = matches[matches.length - 1];
  const lastIndex = last.index ?? 0;
  const before = body.slice(0, lastIndex).trim();
  const after = body.slice(lastIndex + last[0].length).trim();
  return { local: before, periodoTexto: after ? after.toUpperCase() : null };
}

/** Convenção "LOCAL; SET" — o que vem antes do primeiro ";" agrupa vários `set` na mesma
 *  Locacao; sem ";", locação e set são o mesmo valor. Mais de um ";": só o primeiro separa,
 *  o resto fica concatenado no set (ex.: "CASA; QUARTO; ARMÁRIO" → locação CASA, set
 *  "QUARTO; ARMÁRIO"), igual à convenção já usada pelo parser de PDF. */
function splitLocacaoSet(local: string): { locacaoNome: string | null; set: string | null } {
  const semicolon = local.indexOf(";");
  if (semicolon < 0) {
    const value = local.trim().toUpperCase() || null;
    return { locacaoNome: value, set: value };
  }
  const locacaoNome = local.slice(0, semicolon).trim().toUpperCase() || null;
  const set = local.slice(semicolon + 1).trim().toUpperCase() || null;
  return { locacaoNome, set: set ?? locacaoNome };
}

function parseHeading(raw: string): ParsedHeading {
  const heading = stripInsertPrefix(raw.trim());
  if (!heading) {
    return { tipo: null, locacaoNome: null, set: null, periodo: null, periodoFim: null, classeLuz: "INDEFINIDO" };
  }

  const hasTipoPrefix = TIPO_PREFIX_PATTERN.test(heading);
  const tipo: FdxScene["tipo"] = hasTipoPrefix ? (/^EXT/i.test(heading) ? "EXT" : "INT") : null;
  const body = (hasTipoPrefix ? heading.replace(TIPO_PREFIX_PATTERN, "") : heading).trim() || heading;

  const { local, periodoTexto } = splitLocalPeriodo(body);
  const { locacaoNome, set } = splitLocacaoSet(local);
  const { classeLuz, periodoFim } = deriveClasseLuz(periodoTexto);

  return { tipo, locacaoNome, set, periodo: periodoTexto, periodoFim, classeLuz };
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

/** Quantas linhas físicas um texto ocupa quebrado por PALAVRA numa largura útil de N caracteres —
 *  nunca divide uma palavra ao meio (diferente de `text.length / largura`, que erra a cada
 *  palavra cortada no limite e acumula erro cena após cena). Uma palavra sozinha maior que a
 *  largura ainda ocupa só 1 linha (ela transborda, mas não quebra). */
function wrapLineCount(text: string, chars: number): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;
  let lines = 1;
  let currentLen = 0;
  for (const word of words) {
    const candidateLen = currentLen === 0 ? word.length : currentLen + 1 + word.length;
    if (candidateLen > chars && currentLen > 0) {
      lines += 1;
      currentLen = word.length;
    } else {
      currentLen = candidateLen;
    }
  }
  return lines;
}

/** Oitavo mede ESPAÇO DE PÁGINA, não volume de texto — conta TODO parágrafo da cena (cabeçalho,
 *  ação, personagem, parêntese, diálogo, transição), não só ação/diálogo, e soma a linha em
 *  branco que a formatação padrão insere antes de cabeçalho/ação/personagem/transição (parêntese
 *  e diálogo colam direto no parágrafo anterior, sem branco). Sem isso, cenas com bastante diálogo
 *  curto (muita troca de personagem, muitos parênteses, muita linha em branco) saem contadas bem
 *  abaixo do que realmente ocupam na página impressa. */
function countLinhasSimulado(paragraphs: FdxNode[]): number {
  let linhas = 0;
  for (const p of paragraphs) {
    const text = paragraphText(p);
    if (!text) continue;
    const type = paragraphType(p);
    if (BLANK_LINE_BEFORE_TYPES.has(type)) linhas += 1;
    if (type === "Transition") {
      // Sem regra de largura própria (linha curta por convenção, ex.: "CORTA PARA:") — não
      // quebra, sempre 1 linha.
      linhas += 1;
    } else {
      const chars = CHARS_PER_LINE_BY_TYPE[type] ?? DEFAULT_CHARS_PER_LINE;
      linhas += wrapLineCount(text, chars);
    }
  }
  return linhas;
}

function buildScene(numero: string, numeroGerado: boolean, paragraphs: FdxNode[]): FdxScene {
  const heading = paragraphs.find((p) => paragraphType(p) === "Scene Heading");
  const { tipo, locacaoNome, set, periodo, periodoFim, classeLuz } = parseHeading(heading ? paragraphText(heading) : "");

  const actionParagraphs = paragraphs.filter((p) => paragraphType(p) === "Action");
  const dialogueParagraphs = paragraphs.filter((p) => paragraphType(p) === "Dialogue");
  const characterParagraphs = paragraphs.filter((p) => paragraphType(p) === "Character");

  const firstAction = actionParagraphs.length > 0 ? paragraphText(actionParagraphs[0]) : "";
  const sinopse = firstAction ? (firstAction.length > 200 ? `${firstAction.slice(0, 200).trimEnd()}…` : firstAction) : null;

  const linhas = countLinhasSimulado(paragraphs);
  const linhasPorOitavo = LINHAS_POR_PAGINA_PADRAO / 8;
  const eighths = Math.max(1, Math.round(linhas / linhasPorOitavo));
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
    periodoFim,
    classeLuz,
    set,
    locacaoNome,
    sinopse,
    personagens,
    paginas,
    linhas,
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
  if (!content) return { scenes: [], avisos: [], sugestoesFusao: [] };

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
    // Ordem do roteiro importa pra herança (cena N pode herder de N-1) — roda ANTES de contar
    // os avisos, senão "sem herança" contaria cenas que a própria herança já resolveu.
    const semHeranca = applyClasseLuzInheritance(scenes);

    const semTipo = scenes.filter((s) => s.tipo == null).length;
    const semPeriodo = scenes.filter((s) => s.periodo == null).length;
    const naoReconhecidas = scenes.filter((s) => s.periodo != null && !isPeriodoTextoReconhecido(s.periodo)).length;
    const numerosGerados = scenes.filter((s) => s.numeroGerado).length;
    if (semTipo > 0) avisos.push(`${semTipo} cenas sem cabeçalho INT/EXT detectado`);
    if (semPeriodo > 0) avisos.push(`${semPeriodo} cenas sem período (Dia/Noite) detectado`);
    if (naoReconhecidas > 0)
      avisos.push(`${naoReconhecidas} cenas com período não reconhecido — confira classificação dia/noite`);
    if (semHeranca > 0)
      avisos.push(`${semHeranca} cenas sem período determinável (ex.: 1ª cena do roteiro é "contínuo") — revise manualmente`);
    if (numerosGerados > 0) avisos.push("Numeração de cenas gerada automaticamente");
  }

  const sugestoesFusao = detectSetFusionSuggestions(scenes);

  return { scenes, avisos, sugestoesFusao };
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
