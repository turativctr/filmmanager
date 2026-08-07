import { extractPdfPagesInBrowser } from "@/lib/pdf-script-extract-browser";

export { PdfScriptStructureError } from "@/lib/pdf-script-extract-browser";

/** Monta o FormData enviado às rotas de import de roteiro. .fdx/.wdz vai como arquivo bruto,
 *  igual sempre foi; .pdf é extraído no navegador primeiro (ver pdf-script-extract-browser.ts) e
 *  só o texto já posicionado é enviado — o binário do PDF nunca sai do dispositivo. Pode lançar
 *  PdfScriptStructureError se o PDF não tiver texto extraível (documento escaneado). */
export async function buildScriptFormData(file: File): Promise<FormData> {
  const formData = new FormData();
  if (/\.pdf$/i.test(file.name)) {
    const pages = await extractPdfPagesInBrowser(file);
    formData.append("extractedPages", JSON.stringify(pages));
  } else {
    formData.append("file", file);
  }
  return formData;
}
