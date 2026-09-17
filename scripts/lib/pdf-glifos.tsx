/**
 * Caracteres que a Helvetica embutida do react-pdf não tem saem como lixo ("Δ" vira "”", "≥" vira
 * "e") ou somem ("✓", "⚠") — sem erro nenhum. A lista não é chutada: todo caractere não-ASCII
 * escrito no código que gera PDF é renderizado de verdade e lido de volta.
 *
 * Varre src/lib/pdf/* e tudo que esses arquivos importam dentro de src/ (rótulos, formatadores,
 * geradores de texto). Comentários não contam. Texto digitado pelo usuário no banco fica de fora.
 */
import { Document, Page, renderToBuffer, Text } from "@react-pdf/renderer";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type GlifoQuebrado = { caractere: string; lido: string; onde: string[] };

const RAIZ = path.resolve(__dirname, "../..");

function resolverImport(spec: string, deArquivo: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(RAIZ, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(deArquivo), spec);
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidato = base + ext;
    if (existsSync(candidato) && statSync(candidato).isFile()) return candidato;
  }
  return null;
}

function arquivosQueGeramPdf(): string[] {
  const dirPdf = path.join(RAIZ, "src/lib/pdf");
  const pilha = readdirSync(dirPdf).map((f) => path.join(dirPdf, f));
  const vistos = new Set<string>();
  while (pilha.length > 0) {
    const arquivo = pilha.pop()!;
    if (vistos.has(arquivo)) continue;
    vistos.add(arquivo);
    for (const m of readFileSync(arquivo, "utf8").matchAll(/from\s+"([^"]+)"/g)) {
      const alvo = resolverImport(m[1], arquivo);
      if (alvo) pilha.push(alvo);
    }
  }
  return [...vistos].sort();
}

/** Tira comentários mantendo as quebras de linha (pra número de linha continuar certo). */
function semComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((linha) => linha.replace(/(^|[^:"'`\\])\/\/.*$/, "$1"))
    .join("\n");
}

export async function encontrarGlifosQuebrados(): Promise<{ arquivos: number; quebrados: GlifoQuebrado[] }> {
  const arquivos = arquivosQueGeramPdf();
  const ocorrencias = new Map<string, string[]>();
  for (const arquivo of arquivos) {
    semComentarios(readFileSync(arquivo, "utf8"))
      .split("\n")
      .forEach((linha, i) => {
        for (const c of new Set(linha)) {
          const cp = c.codePointAt(0)!;
          // Acentos combinantes só aparecem em regex de normalização (normalize("NFD")), nunca impressos.
          if (cp <= 127 || (cp >= 0x300 && cp <= 0x36f)) continue;
          const lista = ocorrencias.get(c) ?? [];
          lista.push(`${path.relative(RAIZ, arquivo)}:${i + 1}`);
          ocorrencias.set(c, lista);
        }
      });
  }

  const caracteres = [...ocorrencias.keys()];
  const buffer = await renderToBuffer(
    <Document>
      {caracteres.flatMap((c) =>
        [400, 700].map((peso) => (
          <Page key={`${c}${peso}`} style={{ fontFamily: "Helvetica" }}>
            <Text style={{ fontWeight: peso }}>{`a${c}b`}</Text>
          </Page>
        ))
      )}
    </Document>
  );
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;

  const quebrados: GlifoQuebrado[] = [];
  for (let i = 0; i < caracteres.length; i++) {
    for (let p = 0; p < 2; p++) {
      const page = await doc.getPage(i * 2 + p + 1);
      const lido = (await page.getTextContent()).items.map((it) => ("str" in it ? it.str : "")).join("");
      if (lido !== `a${caracteres[i]}b`) {
        quebrados.push({ caractere: caracteres[i], lido: lido.slice(1, -1), onde: ocorrencias.get(caracteres[i])! });
        break;
      }
    }
  }
  return { arquivos: arquivos.length, quebrados };
}
