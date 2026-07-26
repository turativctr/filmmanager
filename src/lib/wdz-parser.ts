/**
 * Extrai o XML compatível com Final Draft de dentro de um arquivo .wdz (WriterDuet).
 *
 * O .wdz não tem um schema documentado publicamente; a suposição aqui é que é um zip
 * contendo em algum lugar um XML no mesmo formato lido por lib/fdx-parser.ts (WriterDuet
 * anuncia exportação "compatível com Final Draft"). Em vez de depender do nome do arquivo
 * dentro do zip (que pode variar), procuramos pela ASSINATURA do conteúdo ("<FinalDraft")
 * em cada entrada — se a suposição estiver errada para algum arquivo real, isso falha com
 * um erro claro em vez de silenciosamente importar dados errados.
 */
import JSZip from "jszip";

export async function extractFdxXmlFromWdz(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    if (!/\.(xml|fdx)$/i.test(entry.name)) continue;
    const text = await entry.async("text");
    if (/<FinalDraft[\s>]/i.test(text)) return text;
  }

  throw new Error(
    "Não foi possível encontrar um roteiro compatível dentro do arquivo .wdz. Tente exportar como .fdx."
  );
}
