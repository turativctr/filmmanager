const ACCEPTED_SCRIPT_EXTENSIONS = [".fdx", ".pdf"];

export const UNSUPPORTED_SCRIPT_FORMAT_MESSAGE = "Formato não suportado. Envie um arquivo .fdx ou .pdf.";

/** Checagem client-side pela extensão do arquivo, ANTES de qualquer requisição — o servidor
 *  ainda valida o conteúdo de verdade (ver /api/.../import/fdx), mas barrar aqui evita disparar
 *  um upload que sabidamente vai falhar. */
export function isAcceptedScriptFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_SCRIPT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
