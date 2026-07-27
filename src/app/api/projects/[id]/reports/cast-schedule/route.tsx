import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { getCastScheduleData } from "@/lib/ad-documents-data";
import { authOptions } from "@/lib/auth";
import { gerarNomeArquivo } from "@/lib/filename";
import { CastScheduleDocument } from "@/lib/pdf/cast-schedule-document";
import { findOwnedProject } from "@/lib/project-access";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const data = await getCastScheduleData(params.id);
  const buffer = await renderToBuffer(<CastScheduleDocument data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "CronogramaElenco", ext: "pdf" })}"`,
    },
  });
}
