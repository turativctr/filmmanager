import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getContinuityNotesReportData } from "@/lib/ad-documents-data";
import { gerarNomeArquivo } from "@/lib/filename";
import { ContinuityNotesDocument } from "@/lib/pdf/continuity-notes-document";
import { findOwnedProject } from "@/lib/project-access";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const data = await getContinuityNotesReportData(params.id);
  const buffer = await renderToBuffer(<ContinuityNotesDocument data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "NotasContinuidade", ext: "pdf" })}"`,
    },
  });
}
