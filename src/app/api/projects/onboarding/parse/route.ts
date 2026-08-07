import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { parseFdx, parseFdxTitlePage } from "@/lib/fdx-parser";
import { buildScriptFromPdfPages, parseExtractedPagesPayload, PdfScriptStructureError } from "@/lib/pdf-script-parser";
import { extractFdxXmlFromWdz } from "@/lib/wdz-parser";

import type { FdxParseResult, FdxTitlePage } from "@/lib/fdx-parser";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const formData = await request.formData();

  // Roteiro em .pdf: o texto já vem extraído do navegador (ver pdf-script-extract-browser.ts) —
  // pdfjs nunca roda no servidor. Aqui só validamos a estrutura recebida (o servidor não confia
  // cegamente no payload) e processamos.
  const extractedPagesRaw = formData.get("extractedPages");
  if (typeof extractedPagesRaw === "string") {
    let result: FdxParseResult;
    try {
      const pages = parseExtractedPagesPayload(JSON.parse(extractedPagesRaw));
      result = buildScriptFromPdfPages(pages);
    } catch (error) {
      if (error instanceof PdfScriptStructureError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("[onboarding/parse] Falha ao processar PDF:", error);
      return NextResponse.json({ error: "Não foi possível ler o arquivo PDF enviado." }, { status: 400 });
    }
    if (result.scenes.length === 0) {
      return NextResponse.json({ error: "Nenhuma cena encontrada no roteiro." }, { status: 400 });
    }
    const titlePage: FdxTitlePage = {
      tituloSugerido: null,
      roteiristas: null,
      numeroDraft: null,
      dataDraft: null,
      contatoProducao: null,
    };
    return NextResponse.json({ ...result, titlePage });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo .fdx ou .pdf não enviado." }, { status: 400 });
  }

  // Sem fallback server-side pra PDF: um .pdf sempre deveria chegar aqui já extraído (branch
  // acima). Se chegou como arquivo bruto, o cliente está desatualizado ou pulou a extração.
  if (/\.pdf$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Não foi possível processar o PDF no navegador. Recarregue a página e tente novamente." },
      { status: 400 }
    );
  }

  let xml: string;
  try {
    if (/\.wdz$/i.test(file.name)) {
      const buffer = Buffer.from(await file.arrayBuffer());
      xml = await extractFdxXmlFromWdz(buffer);
    } else {
      xml = await file.text();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível ler o arquivo enviado.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let scenes, avisos;
  try {
    ({ scenes, avisos } = parseFdx(xml));
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler o roteiro. Verifique se é um .fdx/.wdz válido." },
      { status: 400 }
    );
  }

  if (scenes.length === 0) {
    return NextResponse.json({ error: "Nenhuma cena encontrada no roteiro." }, { status: 400 });
  }

  const titlePage = parseFdxTitlePage(xml);

  return NextResponse.json({ scenes, avisos, titlePage });
}
