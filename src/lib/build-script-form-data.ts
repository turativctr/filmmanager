import { extractPdfPagesInBrowser } from "@/lib/pdf-script-extract-browser";

export { PdfScriptStructureError } from "@/lib/pdf-script-extract-browser";

// Teto pra qualquer operação de import de roteiro (extração no navegador + requisição ao
// servidor) — sem isso, um PDF que trava o parser ou uma resposta de rede que nunca chega
// deixaria o diálogo "carregando" pra sempre, o que também bloqueia fechar (ver handleOpenChange
// nos diálogos). Generoso o bastante pra um roteiro grande num aparelho lento.
export const SCRIPT_OPERATION_TIMEOUT_MS = 60_000;
export const OPERATION_TIMEOUT_MESSAGE = "A operação demorou demais e foi cancelada. Tente novamente.";

/** Monta o FormData enviado às rotas de import de roteiro. .fdx/.wdz vai como arquivo bruto,
 *  igual sempre foi; .pdf é extraído no navegador primeiro (ver pdf-script-extract-browser.ts) e
 *  só o texto já posicionado é enviado — o binário do PDF nunca sai do dispositivo. Pode lançar
 *  PdfScriptStructureError se o PDF não tiver texto extraível (documento escaneado), ou um
 *  AbortError se `signal` for abortado (cancelamento manual ou timeout). */
export async function buildScriptFormData(file: File, signal?: AbortSignal): Promise<FormData> {
  const formData = new FormData();
  if (/\.pdf$/i.test(file.name)) {
    const pages = await extractPdfPagesInBrowser(file, signal);
    formData.append("extractedPages", JSON.stringify(pages));
  } else {
    formData.append("file", file);
  }
  return formData;
}
