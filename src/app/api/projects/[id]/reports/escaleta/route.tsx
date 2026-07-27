import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { getEscaletaData } from "@/lib/ad-documents-data";
import { authOptions } from "@/lib/auth";
import { gerarNomeArquivo } from "@/lib/filename";
import { EscaletaDocument } from "@/lib/pdf/escaleta-document";
import { findOwnedProject } from "@/lib/project-access";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const data = await getEscaletaData(params.id);
  const buffer = await renderToBuffer(<EscaletaDocument data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "Escaleta", ext: "pdf" })}"`,
    },
  });
}
