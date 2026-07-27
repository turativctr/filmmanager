import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getScriptDraftDetail } from "@/lib/draft-report-data";
import { gerarNomeArquivo } from "@/lib/filename";
import { ChangedPagesDocument } from "@/lib/pdf/changed-pages-document";
import { findOwnedProject } from "@/lib/project-access";

export async function GET(request: Request, { params }: { params: { id: string; draftId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const detail = await getScriptDraftDetail(params.id, params.draftId);
  if (!detail) return NextResponse.json({ error: "Draft não encontrado." }, { status: 404 });

  const buffer = await renderToBuffer(<ChangedPagesDocument detail={detail} />);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "PaginasAlteradas", variante: `Draft${detail.draft.numero}${detail.draft.corRevisao}`, ext: "pdf" })}"`,
    },
  });
}
