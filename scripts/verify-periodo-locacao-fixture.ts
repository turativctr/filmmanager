/**
 * Verifica a correção de DEFEITO 1 (período vazando pro nome da locação) e DEFEITO 2 (";" não
 * separando locação/set) contra o gabarito real "Familiar Insônia" — mesmo fixture de
 * scripts/verify-eighths-fixture.ts, mas SEM tocar em oitavos (ver o pedido original: "não mexer
 * em oitavos" — esse script cobre só período/classeLuz/locação/set/fusão).
 *
 * Roda os dois parsers (PDF e FDX) e verifica pra cada um:
 *   - Nenhum nome de locação contém " - " (o próprio defeito original).
 *   - detectSetFusionSuggestions encontra exatamente as duas fusões esperadas ("QUARTO DOS PAIS"
 *     e "QUARTO DE CECÍLIA", cada um solto em algumas cenas e aninhado em "CASA" nas outras).
 *   - Depois de ACEITAR as duas fusões (simulando o clique em "Unificar" na prévia), a locação
 *     final bate exatamente com o gabarito: 3 locações, 9 sets.
 *   - periodo (texto) e classeLuz batem exatamente pra cada uma das 19 cenas.
 *   - A cadeia de herança das cenas 14–19 resolve em NOITE a partir da ponta final (periodoFim)
 *     da cena 13, que é TRANSICAO NOITE→MADRUGADA.
 *
 *   npm run verify:periodo
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectSetFusionSuggestions, parseFdx, type FdxScene, type FusionSuggestion } from "../src/lib/fdx-parser";
import { buildScriptFromPdfPages } from "../src/lib/pdf-script-parser";
import { extractPdfPagesInNode } from "./lib/extract-pdf-node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");

// Gabarito de período/classeLuz por cena — ver o pedido original pra a tabela completa e o
// raciocínio de herança (cena 14 herda a PONTA FINAL de 13, que é TRANSICAO NOITE→MADRUGADA;
// 15–19 herdam direto de 14, já resolvida NOITE).
const GOLDEN_PERIODO: { numero: string; periodo: string; classeLuz: FdxScene["classeLuz"]; periodoFim: string | null }[] = [
  { numero: "1", periodo: "MADRUGADA", classeLuz: "NOITE", periodoFim: null },
  { numero: "2", periodo: "CONTÍNUO", classeLuz: "NOITE", periodoFim: null },
  { numero: "3", periodo: "MADRUGADA", classeLuz: "NOITE", periodoFim: null },
  { numero: "4", periodo: "MANHÃ", classeLuz: "DIA", periodoFim: null },
  { numero: "5", periodo: "MANHÃ", classeLuz: "DIA", periodoFim: null },
  { numero: "6", periodo: "MANHÃ", classeLuz: "DIA", periodoFim: null },
  { numero: "7", periodo: "NOITE", classeLuz: "NOITE", periodoFim: null },
  { numero: "8", periodo: "MADRUGADA", classeLuz: "NOITE", periodoFim: null },
  { numero: "9", periodo: "MADRUGADA", classeLuz: "NOITE", periodoFim: null },
  { numero: "10", periodo: "MADRUGADA PARA DIA", classeLuz: "TRANSICAO", periodoFim: "DIA" },
  { numero: "11", periodo: "MANHÃ", classeLuz: "DIA", periodoFim: null },
  { numero: "12", periodo: "MANHÃ", classeLuz: "DIA", periodoFim: null },
  { numero: "13", periodo: "NOITE PARA MADRUGADA", classeLuz: "TRANSICAO", periodoFim: "MADRUGADA" },
  { numero: "14", periodo: "CONTINUA", classeLuz: "NOITE", periodoFim: null },
  { numero: "15", periodo: "CONTINUA", classeLuz: "NOITE", periodoFim: null },
  { numero: "16", periodo: "CONTINUA", classeLuz: "NOITE", periodoFim: null },
  { numero: "17", periodo: "CONTINUA", classeLuz: "NOITE", periodoFim: null },
  { numero: "18", periodo: "CONTINUA", classeLuz: "NOITE", periodoFim: null },
  { numero: "19", periodo: "CONTINUA", classeLuz: "NOITE", periodoFim: null },
];

// Gabarito final de locação/set — DEPOIS de aceitar as duas fusões sugeridas (QUARTO DOS PAIS e
// QUARTO DE CECÍLIA, ambos solto+aninhado em CASA). 3 locações, 9 sets.
const GOLDEN_LOCACOES: Record<string, Record<string, string[]>> = {
  CASA: {
    BANHEIRO: ["18"],
    CORREDOR: ["15", "17", "19"],
    COZINHA: ["3", "12"],
    "QUARTO DE CECÍLIA": ["9", "16"],
    "QUARTO DOS PAIS": ["1", "7", "8", "10", "13"],
    "SALA DE ESTAR": ["4"],
    SUÍTE: ["2", "11", "14"],
  },
  CARRO: { CARRO: ["5"] },
  "CONSULTÓRIO MÉDICO": { "CONSULTÓRIO MÉDICO": ["6"] },
};

const EXPECTED_FUSOES = new Set(["QUARTO DOS PAIS::CASA", "QUARTO DE CECÍLIA::CASA"]);

function fail(label: string, message: string): never {
  console.error(`FALHA [${label}]: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function verifyNoLeakedSeparator(label: string, scenes: FdxScene[]) {
  for (const s of scenes) {
    if (s.locacaoNome?.includes(" - ")) {
      fail(label, `locação "${s.locacaoNome}" (cena ${s.numero}) ainda contém " - " — período vazou pro nome`);
    }
  }
  console.log(`  OK  nenhum nome de locação contém " - "`);
}

function verifyPeriodoTable(label: string, scenes: FdxScene[]) {
  const byNumero = new Map(scenes.map((s) => [s.numero, s]));
  let ok = true;
  for (const golden of GOLDEN_PERIODO) {
    const scene = byNumero.get(golden.numero);
    if (!scene) {
      console.error(`  FORA cena ${golden.numero}: não encontrada`);
      ok = false;
      continue;
    }
    const periodoOk = scene.periodo === golden.periodo;
    const classeOk = scene.classeLuz === golden.classeLuz;
    const fimOk = (scene.periodoFim ?? null) === golden.periodoFim;
    if (periodoOk && classeOk && fimOk) {
      console.log(`  OK   cena ${golden.numero.padStart(2)}: periodo="${scene.periodo}" classeLuz=${scene.classeLuz}`);
    } else {
      ok = false;
      console.error(
        `  FORA cena ${golden.numero}: periodo="${scene.periodo}" (esperado "${golden.periodo}") ` +
          `classeLuz=${scene.classeLuz} (esperado ${golden.classeLuz}) ` +
          `periodoFim=${scene.periodoFim} (esperado ${golden.periodoFim})`
      );
    }
  }
  if (!ok) fail(label, "tabela de período/classeLuz não bateu com o gabarito");
}

function verifyHerancaCadeia1419(label: string, scenes: FdxScene[]) {
  const byNumero = new Map(scenes.map((s) => [s.numero, s]));
  const cena13 = byNumero.get("13")!;
  if (cena13.classeLuz !== "TRANSICAO" || cena13.periodoFim !== "MADRUGADA") {
    fail(label, `cena 13 deveria ser TRANSICAO com periodoFim="MADRUGADA", veio classeLuz=${cena13.classeLuz} periodoFim=${cena13.periodoFim}`);
  }
  for (const numero of ["14", "15", "16", "17", "18", "19"]) {
    const scene = byNumero.get(numero)!;
    if (scene.classeLuz !== "NOITE") {
      fail(label, `cena ${numero} deveria herdar NOITE (ponta final "MADRUGADA" da cena 13), veio ${scene.classeLuz}`);
    }
  }
  console.log("  OK  cadeia de herança 14→19 resolve em NOITE a partir da ponta final da cena 13");
}

function verifyFusionSuggestions(label: string, scenes: FdxScene[]): FusionSuggestion[] {
  const sugestoes = detectSetFusionSuggestions(scenes);
  const found = new Set<string>();
  for (const s of sugestoes) {
    for (const parent of s.aninhadoEm) {
      found.add(`${s.set}::${parent.locacaoNome}`);
    }
  }
  const missing = [...EXPECTED_FUSOES].filter((k) => !found.has(k));
  const extra = [...found].filter((k) => !EXPECTED_FUSOES.has(k));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      label,
      `sugestões de fusão não batem — faltando: [${missing.join(", ")}], inesperadas: [${extra.join(", ")}]`
    );
  }
  console.log(`  OK  detectSetFusionSuggestions encontrou exatamente as 2 fusões esperadas`);
  return sugestoes;
}

/** Simula o AD clicando "Unificar" em toda sugestão encontrada — mesma operação de
 *  onAcceptFusion em fdx-scene-preview.tsx: reescreve locacaoNome nas cenas soltas pro nome da
 *  locação-pai. */
function applyAllFusions(scenes: FdxScene[], sugestoes: FusionSuggestion[]): FdxScene[] {
  const rename = new Map<string, string>(); // numero -> novo locacaoNome
  for (const s of sugestoes) {
    for (const parent of s.aninhadoEm) {
      for (const numero of s.cenasSolto) rename.set(numero, parent.locacaoNome);
    }
  }
  return scenes.map((s) => (rename.has(s.numero) ? { ...s, locacaoNome: rename.get(s.numero)! } : s));
}

function verifyLocacaoGrouping(label: string, scenes: FdxScene[]) {
  const grouping: Record<string, Record<string, string[]>> = {};
  for (const s of scenes) {
    const locacao = s.locacaoNome ?? s.set;
    const set = s.set ?? s.locacaoNome;
    if (!locacao || !set) continue;
    grouping[locacao] ??= {};
    grouping[locacao][set] ??= [];
    grouping[locacao][set].push(s.numero);
  }

  const gotLocacoes = Object.keys(grouping).sort();
  const wantLocacoes = Object.keys(GOLDEN_LOCACOES).sort();
  if (JSON.stringify(gotLocacoes) !== JSON.stringify(wantLocacoes)) {
    fail(label, `locações finais = [${gotLocacoes.join(", ")}], esperado [${wantLocacoes.join(", ")}]`);
  }

  let totalSets = 0;
  let ok = true;
  for (const locacao of wantLocacoes) {
    const gotSets = Object.keys(grouping[locacao]).sort();
    const wantSets = Object.keys(GOLDEN_LOCACOES[locacao]).sort();
    totalSets += wantSets.length;
    if (JSON.stringify(gotSets) !== JSON.stringify(wantSets)) {
      ok = false;
      console.error(`  FORA ${locacao}: sets = [${gotSets.join(", ")}], esperado [${wantSets.join(", ")}]`);
      continue;
    }
    for (const set of wantSets) {
      const got = [...grouping[locacao][set]].sort((a, b) => Number(a) - Number(b));
      const want = [...GOLDEN_LOCACOES[locacao][set]].sort((a, b) => Number(a) - Number(b));
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        ok = false;
        console.error(`  FORA ${locacao}/${set}: cenas = [${got.join(",")}], esperado [${want.join(",")}]`);
      }
    }
  }
  if (!ok) fail(label, "agrupamento locação/set não bateu com o gabarito depois da fusão");
  console.log(`  OK  ${wantLocacoes.length} locações, ${totalSets} sets — bate exatamente com o gabarito`);
}

function verify(label: string, scenes: FdxScene[]) {
  console.log(`\n=== ${label} ===`);
  verifyNoLeakedSeparator(label, scenes);
  verifyPeriodoTable(label, scenes);
  verifyHerancaCadeia1419(label, scenes);
  const sugestoes = verifyFusionSuggestions(label, scenes);
  const fundidas = applyAllFusions(scenes, sugestoes);
  verifyLocacaoGrouping(label, fundidas);
  console.log(`${label}: PASSOU`);
}

async function main() {
  const fdxXml = await readFile(path.join(FIXTURES_DIR, "familiar-insonia.fdx"), "utf8");
  const fdxResult = parseFdx(fdxXml);
  verify("FDX", fdxResult.scenes);

  const pdfBuffer = await readFile(path.join(FIXTURES_DIR, "familiar-insonia.pdf"));
  const pdfPages = await extractPdfPagesInNode(pdfBuffer);
  const pdfResult = buildScriptFromPdfPages(pdfPages);
  verify("PDF", pdfResult.scenes);

  console.log("\nTUDO OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
