import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { gerarNomeArquivo } from "@/lib/filename";
import { HHScheduleDocument } from "@/lib/pdf/hh-schedule-document";
import { findOwnedProject } from "@/lib/project-access";
import { getShootDayReportData } from "@/lib/report-data";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDayId = new URL(request.url).searchParams.get("day");
  if (!shootDayId) return NextResponse.json({ error: "Parâmetro 'day' é obrigatório." }, { status: 400 });

  const data = await getShootDayReportData(params.id, shootDayId);
  if (!data) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const buffer = await renderToBuffer(<HHScheduleDocument data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "PlanoHH", variante: `Diaria${data.shootDay.numeroDia}`, ext: "pdf" })}"`,
    },
  });
}
