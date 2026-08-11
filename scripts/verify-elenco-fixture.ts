/**
 * Verifica a detecção de elenco (com e sem fala) contra o gabarito real "Familiar Insônia" —
 * mesmo fixture de scripts/verify-eighths-fixture.ts, sem tocar em oitavos/período/locação.
 *
 * O teste que MAIS importa aqui é a lista negativa: objeto de cena, marcação e caixa alta
 * acidental NÃO podem virar personagem. Um elenco com TUPPERWARE dentro é pior que um elenco sem
 * a Cecília — personagem faltando o AD percebe, elenco cheio de objeto faz ele desistir da
 * importação inteira. Por isso a lista negativa falha o script inteiro, não só avisa.
 *
 *   npm run verify:elenco
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFdx } from "../src/lib/fdx-parser";
import { buildScriptFromPdfPages } from "../src/lib/pdf-script-parser";
import { extractPdfPagesInNode } from "./lib/extract-pdf-node";

import type { FdxParseResult } from "../src/lib/fdx-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");

const GOLDEN_COM_FALA = ["HEITOR", "HELENA", "VERÔNICA"];

// Cenas por personagem sem fala. CECÍLIA inclui a cena 14 além de 8/9/16: a 14 tem um SEGUNDO
// grito dela fora de quadro ("Cecília GRITA. É mais alto. Viceral."), do mesmo tipo do grito da
// cena 8 — se o vínculo da 8 está certo (ela é convocada mesmo sem estar em quadro), o da 14 está
// pela mesma razão. Ver o relatório da rodada em que isso foi levantado.
const GOLDEN_SEM_FALA: Record<string, string[]> = {
  CECÍLIA: ["8", "9", "14", "16"],
  MULHER: ["6", "16"],
  CRIATURA: ["8", "12", "13"],
};

// HELENA é a protagonista e aparece em cenas onde não fala — o defeito que motivou esta rodada
// era exatamente ela sumir dessas cenas (a coluna Personagens vinha vazia em 1, 2, 3 e 5).
const GOLDEN_HELENA_CENAS = ["1", "2", "3", "5"];

// Nada disto pode aparecer no elenco: objeto de cena, marcação/transição e caixa alta acidental.
const LISTA_NEGATIVA = [
  "TUPPERWARE", "LEITEIRA", "ARMA", "PIRULITO DE CORAÇÃO", "LANCHEIRA ROXA DE FADA",
  "XÍCARA DE CAFÉ", "BOMBONIERE DE VIDRO", "CAIXA DE LEITE", "FOGÃO", "TELEVISÃO",
  "COLAR", "CHAVE", "LIVRO", "DENTE", "PAPÉIS TOALHAS", "SANDUÍCHE", "ALARME",
  "EFEITO DE MADRUGADA", "CORTE SECO", "TELA PRETA", "PARA", "TODAS", "MOMENTO",
  "DESSE", "VOLTAMOS", "TEMPO", "GRITA", "BARULHO", "SOMBRA", "SILHUETA",
];

function sorted(list: string[]): string[] {
  return [...list].sort();
}

function sortedCenas(list: string[]): string[] {
  return [...list].sort((a, b) => Number(a) - Number(b));
}

function verify(label: string, result: FdxParseResult): boolean {
  console.log(`\n=== ${label} ===`);
  let ok = true;

  const semFalaNomes = new Set(result.personagensSemFalaDetectados.map((p) => p.nome));
  const elencoTotal = [...new Set(result.scenes.flatMap((s) => s.personagens))];
  const comFala = elencoTotal.filter((n) => !semFalaNomes.has(n));

  // 1. Lista negativa — o teste que importa.
  const vazamentos = LISTA_NEGATIVA.filter((termo) => elencoTotal.includes(termo));
  if (vazamentos.length > 0) {
    console.error(`  FORA lista negativa vazou pro elenco: ${vazamentos.join(", ")}`);
    ok = false;
  } else {
    console.log(`  OK  nenhum dos ${LISTA_NEGATIVA.length} termos da lista negativa virou personagem`);
  }

  // 2. Com fala.
  if (JSON.stringify(sorted(comFala)) !== JSON.stringify(sorted(GOLDEN_COM_FALA))) {
    console.error(`  FORA com fala = [${sorted(comFala)}], esperado [${sorted(GOLDEN_COM_FALA)}]`);
    ok = false;
  } else {
    console.log(`  OK  com fala: ${sorted(comFala).join(", ")}`);
  }

  // 3. Sem fala — nomes e cenas vinculadas.
  const gotSemFala = sorted([...semFalaNomes]);
  const wantSemFala = sorted(Object.keys(GOLDEN_SEM_FALA));
  if (JSON.stringify(gotSemFala) !== JSON.stringify(wantSemFala)) {
    console.error(`  FORA sem fala = [${gotSemFala}], esperado [${wantSemFala}]`);
    ok = false;
  } else {
    for (const p of result.personagensSemFalaDetectados) {
      const want = sortedCenas(GOLDEN_SEM_FALA[p.nome]);
      const got = sortedCenas(p.cenas);
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        console.error(`  FORA ${p.nome}: cenas [${got}], esperado [${want}]`);
        ok = false;
      } else {
        console.log(`  OK  sem fala ${p.nome}: cenas ${got.join(", ")}`);
      }
      if (!p.trecho.trim()) {
        console.error(`  FORA ${p.nome}: sem trecho de detecção — a prévia não teria o que mostrar`);
        ok = false;
      }
    }
  }

  // 4. HELENA nas cenas onde ela não fala — o defeito original.
  const helenaCenas = result.scenes.filter((s) => s.personagens.includes("HELENA")).map((s) => s.numero);
  const faltando = GOLDEN_HELENA_CENAS.filter((c) => !helenaCenas.includes(c));
  if (faltando.length > 0) {
    console.error(`  FORA HELENA não vinculada às cenas ${faltando.join(", ")} (só fala em outras)`);
    ok = false;
  } else {
    console.log(`  OK  HELENA vinculada às cenas ${GOLDEN_HELENA_CENAS.join(", ")} mesmo sem falar nelas`);
  }

  console.log(ok ? `${label}: PASSOU` : `${label}: FALHOU`);
  return ok;
}

async function main() {
  const fdxXml = await readFile(path.join(FIXTURES_DIR, "familiar-insonia.fdx"), "utf8");
  const fdxOk = verify("FDX", parseFdx(fdxXml));

  const pdfBuffer = await readFile(path.join(FIXTURES_DIR, "familiar-insonia.pdf"));
  const pdfPages = await extractPdfPagesInNode(pdfBuffer);
  const pdfOk = verify("PDF", buildScriptFromPdfPages(pdfPages));

  const allOk = fdxOk && pdfOk;
  console.log(`\n${allOk ? "TUDO OK" : "FALHOU"}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
