import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { parseFdx, parseFdxTitlePage } from "@/lib/fdx-parser";
import { parsePdfScript, PdfScriptStructureError } from "@/lib/pdf-script-parser";
import { extractFdxXmlFromWdz } from "@/lib/wdz-parser";

import type { FdxParseResult, FdxTitlePage } from "@/lib/fdx-parser";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo .fdx ou .pdf não enviado." }, { status: 400 });
  }

  if (/\.pdf$/i.test(file.name)) {
    let result: FdxParseResult;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      result = await parsePdfScript(buffer);
    } catch (error) {
      if (error instanceof PdfScriptStructureError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      // Log completo (erro + stack) — a mensagem genérica devolvida ao cliente não diz o motivo
      // real; isso é o que aparece nos logs da função pra diagnosticar sem precisar adivinhar.
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
