/**
 * Detector de colisão de texto em PDF — pega o caso em que o conteúdo de uma célula não cabe na
 * largura da coluna e é desenhado por cima da célula vizinha (react-pdf não corta nem avisa: só
 * pinta um texto sobre o outro). Lê a posição de cada trecho de texto com pdfjs; não olha bordas
 * nem fundos.
 *
 * Colisão = dois trechos na mesma faixa vertical cujas caixas horizontais se encostam ou se
 * sobrepõem. Exceção: trechos colados exatamente (folga ~0), na mesma linha de base e desenhados em
 * sequência são continuação da mesma frase — react-pdf quebra um <Text> em vários trechos quando muda a fonte (negrito dentro
 * de normal) — e não contam. Texto passando da borda direita da página também conta.
 */
export type Colisao = { pagina: number; a: string; b: string; folga: number };

type Trecho = { str: string; x0: number; x1: number; base: number; altura: number; ordem: number };

/** Folga mínima entre textos de células diferentes. As células do kit têm 4pt de padding de cada
 *  lado, então vizinhas que cabem ficam a ≥8pt; abaixo de 1pt é texto invadindo a vizinha. */
const FOLGA_MIN = 1;
/** Até onde dois trechos "colados" ainda são a mesma frase quebrada por troca de fonte. */
const CONTINUACAO = 0.15;

export async function encontrarColisoes(buffer: Buffer): Promise<{ colisoes: Colisao[]; paginas: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  const colisoes: Colisao[] = [];

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const larguraPagina = page.getViewport({ scale: 1 }).width;
    const content = await page.getTextContent();

    const trechos: Trecho[] = [];
    for (const raw of content.items) {
      if (!("str" in raw) || raw.str.trim() === "") continue;
      const [a, b, c, , e, f] = raw.transform as number[];
      if (b !== 0 || c !== 0) continue; // texto rotacionado — não é célula de tabela
      const altura = raw.height || Math.abs(a);
      trechos.push({ str: raw.str, x0: e, x1: e + raw.width, base: f, altura, ordem: trechos.length });
    }

    for (const t of trechos) {
      if (t.x1 > larguraPagina + 0.5) {
        colisoes.push({ pagina: n, a: t.str, b: "(borda da página)", folga: larguraPagina - t.x1 });
      }
    }

    for (let i = 0; i < trechos.length; i++) {
      for (let j = i + 1; j < trechos.length; j++) {
        const [a, b] = trechos[i].x0 <= trechos[j].x0 ? [trechos[i], trechos[j]] : [trechos[j], trechos[i]];
        // Faixa vertical ocupada pelas letras: um pouco abaixo da linha de base até ~80% da altura.
        const topoA = a.base + a.altura * 0.8;
        const topoB = b.base + b.altura * 0.8;
        const fundoA = a.base - a.altura * 0.2;
        const fundoB = b.base - b.altura * 0.2;
        const sobreposicaoVertical = Math.min(topoA, topoB) - Math.max(fundoA, fundoB);
        // 20%, não 50%: linhas de células vizinhas desalinhadas meia linha também se tocam.
        if (sobreposicaoVertical < Math.min(a.altura, b.altura) * 0.2) continue;

        const folga = b.x0 - a.x1;
        if (folga >= FOLGA_MIN) continue;
        const mesmaLinha = Math.abs(a.base - b.base) < 0.1;
        // Continuação da mesma frase só se os trechos também forem vizinhos na ordem em que o PDF
        // os desenha — duas colunas coladas por acaso ("gas-tronômi-" | "gas-tronômi-") não são.
        const vizinhosNoPdf = Math.abs(a.ordem - b.ordem) === 1;
        if (mesmaLinha && vizinhosNoPdf && Math.abs(folga) <= CONTINUACAO) continue;
        // Um trecho inteiramente dentro do outro na mesma linha é o mesmo texto repetido pelo
        // extrator (sublinhado, sombra), não duas células.
        if (mesmaLinha && a.str === b.str && Math.abs(a.x0 - b.x0) < 0.1) continue;
        colisoes.push({ pagina: n, a: a.str, b: b.str, folga });
      }
    }
  }

  return { colisoes, paginas: doc.numPages };
}

/** Todo o texto de um PDF, numa string só — usado pra provar que um valor NÃO aparece em documento
 *  nenhum (a reserva de tempo da AD, ver verify:pdf). Junta os trechos com espaço porque react-pdf
 *  quebra frases em vários trechos; quem procura por um horário ("20h37") acha do mesmo jeito. */
export async function textoDoPdf(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  const partes: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    for (const raw of content.items) if ("str" in raw) partes.push(raw.str);
  }
  return partes.join(" ");
}
