/**
 * Extração de texto posicionado de um roteiro em PDF, rodando no NAVEGADOR — pdfjs nunca roda no
 * servidor (ver pdf-script-parser.ts). Isso elimina de raiz o problema original (pdfjs em Node
 * precisa de @napi-rs/canvas ou de um polyfill de DOMMatrix pra sequer carregar; navegador tem
 * DOMMatrix/canvas nativos, então essa classe de bug não existe aqui) e tira o peso do pdfjs da
 * função serverless por completo.
 *
 * Só o resultado desta extração (texto + coordenadas por linha, já em JSON) é enviado ao
 * servidor — o binário do PDF nunca sai do dispositivo da pessoa.
 */
import type { ExtractedPage, Line, RawItem } from "@/lib/pdf-script-types";

export class PdfScriptStructureError extends Error {}

const UNRECOGNIZED_STRUCTURE_MESSAGE =
  "Não foi possível reconhecer a estrutura deste PDF. Ele pode ser um documento escaneado ou não seguir a formatação padrão de roteiro. Envie um arquivo .fdx.";

// Mesmo limiar usado no servidor (ver MIN_TOTAL_CHARS em pdf-script-parser.ts) — checar aqui
// também permite falhar rápido, sem round-trip, quando o PDF é escaneado (imagem sem texto).
const MIN_TOTAL_CHARS = 50;

// Assets do pdfjs servidos como estáticos em /public (copiados de node_modules por
// scripts/copy-pdfjs-assets.mjs, rodado no postinstall — ver esse script pra detalhes).
const PDFJS_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";
const PDFJS_CMAP_URL = "/pdfjs/cmaps/";
const PDFJS_STANDARD_FONT_DATA_URL = "/pdfjs/standard_fonts/";

function abortError(): DOMException {
  return new DOMException("A extração do PDF foi cancelada.", "AbortError");
}

/** signal opcional: permite interromper a extração de fato (não só ignorar o resultado depois) —
 *  destruir a loading task do pdfjs pára o worker imediatamente em vez de deixá-lo rodando em
 *  segundo plano até terminar sozinho (ou nunca terminar, no caso de um PDF que trava o parser). */
export async function extractPdfPagesInBrowser(file: File, signal?: AbortSignal): Promise<ExtractedPage[]> {
  if (signal?.aborted) throw abortError();

  // Build "legacy": não é sobre versão do pdfjs, é a variante com transpilação/polyfills pra
  // navegadores mais antigos — a mesma preocupação de compatibilidade que já existia pro uso no
  // servidor (Node), só que agora relevante para Safari/iPad. A build "moderna" assume
  // JS mais recente e não é o alvo certo aqui.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
  });
  const onAbort = () => loadingTask.destroy();
  signal?.addEventListener("abort", onAbort);

  const pages: ExtractedPage[] = [];
  try {
    const doc = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      if (signal?.aborted) throw abortError();
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
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await loadingTask.destroy().catch(() => {});
  }

  if (signal?.aborted) throw abortError();

  const totalChars = pages.reduce((sum, p) => sum + p.lines.reduce((s, l) => s + l.text.length, 0), 0);
  if (totalChars < MIN_TOTAL_CHARS) {
    throw new PdfScriptStructureError(UNRECOGNIZED_STRUCTURE_MESSAGE);
  }

  return pages;
}
