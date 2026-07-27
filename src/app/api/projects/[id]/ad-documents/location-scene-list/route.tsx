import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { gerarNomeArquivo } from "@/lib/filename";
import { getLocationSceneListData } from "@/lib/ad-documents-data";
import { LocationSceneListDocument } from "@/lib/pdf/location-scene-list-document";
import { findOwnedProject } from "@/lib/project-access";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const data = await getLocationSceneListData(params.id);
  const buffer = await renderToBuffer(<LocationSceneListDocument data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "ListaLocacoes", ext: "pdf" })}"`,
    },
  });
}
