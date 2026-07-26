import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getWeeklyPlanData } from "@/lib/ad-documents-data";
import { gerarNomeArquivo } from "@/lib/filename";
import { WeeklyPlanDocument } from "@/lib/pdf/weekly-plan-document";
import { findOwnedProject } from "@/lib/project-access";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const data = await getWeeklyPlanData(params.id);
  const buffer = await renderToBuffer(<WeeklyPlanDocument data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "PlanoSemanal", ext: "pdf" })}"`,
    },
  });
}
