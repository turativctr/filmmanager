/**
 * Extração de PDF em Node — só pra scripts de dev/manutenção (scripts/verify-eighths-fixture.ts,
 * scripts/recount-eighths.ts). Em produção, pdfjs roda SÓ no navegador (ver
 * src/lib/pdf-script-extract-browser.ts) — Node não tem DOMMatrix/canvas nativos, e é exatamente
 * essa falta que causava o crash em produção que motivou tirar pdfjs do servidor. Aqui, como é
 * script local (nunca roda na função serverless), um polyfill mínimo de DOMMatrix é seguro: só as
 * propriedades a/b/c/d/e/f são lidas pelo caminho de getTextContent (nunca chamamos render()).
 */
import { groupItemsIntoLines } from "../../src/lib/pdf-line-grouping";
import type { ExtractedPage } from "../../src/lib/pdf-script-types";

class MinimalDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  constructor(init?: number[]) {
    if (Array.isArray(init) && init.length === 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }
}
if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === "undefined") {
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = MinimalDOMMatrix;
}

export async function extractPdfPagesInNode(buffer: Buffer): Promise<ExtractedPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;

  const pages: ExtractedPage[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const positioned = [];
    for (const raw of content.items) {
      const item = raw as { str: string; transform: number[]; width?: number };
      if (!item.str) continue;
      positioned.push({
        text: item.str,
        x0: item.transform[4],
        x1: item.transform[4] + (item.width ?? 0),
        y: item.transform[5],
      });
    }
    const lines = groupItemsIntoLines(positioned, pageNumber);

    pages.push({ lines, pageWidth: viewport.width, pageHeight: viewport.height });
  }

  return pages;
}
