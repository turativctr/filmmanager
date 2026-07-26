import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { parseFdx, parseFdxTitlePage } from "@/lib/fdx-parser";
import { extractFdxXmlFromWdz } from "@/lib/wdz-parser";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo .fdx ou .wdz não enviado." }, { status: 400 });
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
