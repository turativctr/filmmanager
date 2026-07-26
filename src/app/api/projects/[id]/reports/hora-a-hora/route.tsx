import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { gerarNomeArquivo } from "@/lib/filename";
import { generateHoraAHoraEvents } from "@/lib/hora-a-hora";
import { HoraAHoraDocument } from "@/lib/pdf/hora-a-hora-document";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { getShootDayReportData } from "@/lib/report-data";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDayId = new URL(request.url).searchParams.get("day");
  if (!shootDayId) return NextResponse.json({ error: "Parâmetro 'day' é obrigatório." }, { status: 400 });

  const data = await getShootDayReportData(params.id, shootDayId);
  if (!data) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const existingCount = await prisma.horaAHoraEvent.count({ where: { shootDayId } });
  if (existingCount === 0) {
    const generated = generateHoraAHoraEvents({
      chamadaGeral: data.shootDay.chamadaGeral,
      almocoInicio: data.shootDay.almocoInicio,
      almocoFim: data.shootDay.almocoFim,
      desprodInicio: data.shootDay.desprodInicio,
      scenes: data.scenes,
      castPresente: data.castPresente,
      project: data.project,
    });
    if (generated.length > 0) {
      await prisma.horaAHoraEvent.createMany({
        data: generated.map((g, i) => ({
          shootDayId,
          horaInicio: g.horaInicio,
          horaFim: g.horaFim,
          descricao: g.descricao,
          tipo: g.tipo,
          geradoAutomaticamente: true,
          ordem: i,
        })),
      });
    }
  }

  const events = await prisma.horaAHoraEvent.findMany({
    where: { shootDayId },
    orderBy: { ordem: "asc" },
  });

  const buffer = await renderToBuffer(
    <HoraAHoraDocument
      data={{
        project: { titulo: data.project.titulo, diretor: data.project.diretor, producao: data.project.producao },
        shootDay: { numeroDia: data.shootDay.numeroDia, data: data.shootDay.data },
        events: events.map((e) => ({
          id: e.id,
          horaInicio: e.horaInicio,
          horaFim: e.horaFim,
          descricao: e.descricao,
          tipo: e.tipo,
        })),
      }}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "HoraAHora", variante: `Diaria${data.shootDay.numeroDia}`, ext: "pdf" })}"`,
    },
  });
}
