/**
 * Verifica a contagem de oitavos (PDF e FDX) contra o gabarito real "Familiar Insônia" —
 * scripts/fixtures/familiar-insonia.{pdf,fdx}. Tolerância: ±1/8 por cena, ±2/8 no total (ver
 * pedido original). Roda os dois parsers, compara cada um contra o gabarito, E faz a
 * verificação cruzada obrigatória (PDF vs FDX convergindo entre si) — falha (exit 1) se
 * qualquer uma dessas checagens sair da tolerância.
 *
 * O .fdx e o .pdf do fixture precisam ser da MESMA revisão do roteiro (mesmo texto) — um
 * roteiro editado depois de exportar o PDF diverge cena a cena e invalida a comparação, não por
 * bug no parser. Usamos aqui o backup do Final Draft com timestamp mais próximo (e anterior) ao
 * CreationDate do PDF.
 *
 *   npm run verify:eighths
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFdx } from "../src/lib/fdx-parser";
import { buildScriptFromPdfPages } from "../src/lib/pdf-script-parser";
import { extractPdfPagesInNode } from "./lib/extract-pdf-node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");

const EIGHTH_TOLERANCE_PER_SCENE = 1;
const EIGHTH_TOLERANCE_TOTAL = 2;

// Gabarito "Familiar Insônia" — 19 cenas, 299 linhas, 46 oitavos (5 6/8 páginas). Linhas medidas
// na geometria real do PDF (Final Draft 12, Letter: passo 12pt, corpo em top=71.6, 53
// linhas/página). Ver o pedido original pra a tabela completa.
const GOLDEN_SCENES: { numero: string; linhas: number; oitavos: number; cabecalho: string }[] = [
  { numero: "1", linhas: 6, oitavos: 1, cabecalho: "INT. CASA; QUARTO DOS PAIS - MADRUGADA" },
  { numero: "2", linhas: 4, oitavos: 1, cabecalho: "INT. CASA; SUÍTE - CONTÍNUO" },
  { numero: "3", linhas: 7, oitavos: 1, cabecalho: "INT. CASA; COZINHA - MADRUGADA" },
  { numero: "4", linhas: 75, oitavos: 11, cabecalho: "INT. CASA; SALA DE ESTAR - MANHÃ" },
  { numero: "5", linhas: 4, oitavos: 1, cabecalho: "INT. CARRO - MANHÃ" },
  { numero: "6", linhas: 38, oitavos: 6, cabecalho: "INT. CONSULTÓRIO MÉDICO - MANHÃ" },
  { numero: "7", linhas: 21, oitavos: 3, cabecalho: "INT. QUARTO DOS PAIS - NOITE" },
  { numero: "8", linhas: 19, oitavos: 3, cabecalho: "INT. CASA; QUARTO DOS PAIS - MADRUGADA" },
  { numero: "9", linhas: 15, oitavos: 2, cabecalho: "INT. QUARTO DE CECÍLIA - MADRUGADA" },
  { numero: "10", linhas: 5, oitavos: 1, cabecalho: "INT. QUARTO DOS PAIS - MADRUGADA PARA DIA" },
  { numero: "11", linhas: 16, oitavos: 2, cabecalho: "INT. CASA; SUÍTE - MANHÃ" },
  { numero: "12", linhas: 20, oitavos: 3, cabecalho: "INT. CASA; COZINHA - MANHÃ" },
  { numero: "13", linhas: 23, oitavos: 3, cabecalho: "INT. CASA; QUARTO DOS PAIS - NOITE PARA MADRUGADA" },
  { numero: "14", linhas: 14, oitavos: 2, cabecalho: "INT. CASA; SUÍTE - CONTINUA" },
  { numero: "15", linhas: 3, oitavos: 1, cabecalho: "INT. CASA; CORREDOR - CONTINUA" },
  { numero: "16", linhas: 14, oitavos: 2, cabecalho: "INT. CASA; QUARTO DE CECÍLIA - CONTINUA" },
  { numero: "17", linhas: 3, oitavos: 1, cabecalho: "INT. CASA; CORREDOR - CONTINUA" },
  { numero: "18", linhas: 4, oitavos: 1, cabecalho: "INT. CASA; BANHEIRO - CONTINUA" },
  { numero: "19", linhas: 8, oitavos: 1, cabecalho: "INT. CASA; CORREDOR - CONTINUA" },
];
const GOLDEN_TOTAL_EIGHTHS = GOLDEN_SCENES.reduce((sum, s) => sum + s.oitavos, 0);

function toEighths(paginas: number): number {
  return Math.round(paginas * 8);
}

function verify(label: string, scenes: { numero: string; linhas: number; paginas: number }[]): { ok: boolean; totalEighths: number } {
  console.log(`\n=== ${label} ===`);
  let ok = true;

  if (scenes.length !== GOLDEN_SCENES.length) {
    console.log(`FALHA: ${scenes.length} cenas detectadas, esperado ${GOLDEN_SCENES.length}`);
    ok = false;
  }

  let totalEighths = 0;
  const rows = Math.max(scenes.length, GOLDEN_SCENES.length);
  for (let i = 0; i < rows; i++) {
    const got = scenes[i];
    const golden = GOLDEN_SCENES[i];
    if (!got || !golden) {
      console.log(`  #${i + 1}: FALTANDO (${got ? "sobrou no resultado" : "faltou no resultado"})`);
      ok = false;
      continue;
    }
    const gotEighths = toEighths(got.paginas);
    totalEighths += gotEighths;
    const diff = Math.abs(gotEighths - golden.oitavos);
    const status = diff <= EIGHTH_TOLERANCE_PER_SCENE ? "OK  " : "FORA";
    if (diff > EIGHTH_TOLERANCE_PER_SCENE) ok = false;
    console.log(
      `  ${status} cena ${golden.numero.padStart(2)}: linhas=${String(got.linhas).padStart(3)} (gabarito ${String(golden.linhas).padStart(3)}) ` +
        `oitavos=${gotEighths}/8 (gabarito ${golden.oitavos}/8, diff ${diff})`
    );
  }

  const totalDiff = Math.abs(totalEighths - GOLDEN_TOTAL_EIGHTHS);
  const totalStatus = totalDiff <= EIGHTH_TOLERANCE_TOTAL ? "OK  " : "FORA";
  if (totalDiff > EIGHTH_TOLERANCE_TOTAL) ok = false;
  console.log(
    `  ${totalStatus} TOTAL: ${totalEighths}/8 (gabarito ${GOLDEN_TOTAL_EIGHTHS}/8, diff ${totalDiff}) — tolerância ±${EIGHTH_TOLERANCE_TOTAL}/8`
  );

  console.log(ok ? `${label}: PASSOU` : `${label}: FALHOU`);
  return { ok, totalEighths };
}

async function main() {
  const fdxXml = await readFile(path.join(FIXTURES_DIR, "familiar-insonia.fdx"), "utf8");
  const fdxResult = parseFdx(fdxXml);
  const fdx = verify("FDX", fdxResult.scenes);

  const pdfBuffer = await readFile(path.join(FIXTURES_DIR, "familiar-insonia.pdf"));
  const pdfPages = await extractPdfPagesInNode(pdfBuffer);
  const pdfResult = buildScriptFromPdfPages(pdfPages);
  const pdf = verify("PDF", pdfResult.scenes);

  // Verificação cruzada obrigatória: os dois parsers lendo o MESMO roteiro é o melhor teste que
  // existe — não depende de o gabarito estar certo, só de PDF e FDX concordarem entre si.
  const crossDiff = Math.abs(pdf.totalEighths - fdx.totalEighths);
  const crossOk = crossDiff <= EIGHTH_TOLERANCE_TOTAL;
  console.log(
    `\n${crossOk ? "OK  " : "FORA"} PDF vs FDX: ${pdf.totalEighths}/8 vs ${fdx.totalEighths}/8 (diff ${crossDiff}) — tolerância ±${EIGHTH_TOLERANCE_TOTAL}/8`
  );

  const allOk = fdx.ok && pdf.ok && crossOk;
  console.log(`\n${allOk ? "TUDO OK" : "FALHOU"}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
