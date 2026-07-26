import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { generateHoraAHoraEvents } from "@/lib/hora-a-hora";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { getShootDayReportData } from "@/lib/report-data";
import { timeToMinutes } from "@/lib/schedule";

// Diferente do "Regenerar checklist" (que só adiciona itens novos por texto), aqui os eventos
// automáticos são inteiramente descartados e recriados: como Hora a Hora é derivado de horários
// (chamada geral, prep/rod, etc.), manter automáticos desatualizados ao lado dos novos criaria
// duplicatas com horários divergentes. Os eventos manuais nunca são tocados.
export async function POST(_request: Request, { params }: { params: { id: string; shootDayId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const data = await getShootDayReportData(params.id, params.shootDayId);
  if (!data) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const generated = generateHoraAHoraEvents({
    chamadaGeral: data.shootDay.chamadaGeral,
    almocoInicio: data.shootDay.almocoInicio,
    almocoFim: data.shootDay.almocoFim,
    desprodInicio: data.shootDay.desprodInicio,
    scenes: data.scenes,
    castPresente: data.castPresente,
    project: data.project,
  });

  const manualEvents = await prisma.horaAHoraEvent.findMany({
    where: { shootDayId: params.shootDayId, geradoAutomaticamente: false },
  });

  await prisma.horaAHoraEvent.deleteMany({ where: { shootDayId: params.shootDayId, geradoAutomaticamente: true } });

  const combined = [
    ...manualEvents.map((e) => ({ kind: "manual" as const, id: e.id, horaInicio: e.horaInicio })),
    ...generated.map((e) => ({ kind: "auto" as const, event: e, horaInicio: e.horaInicio })),
  ].sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));

  await prisma.$transaction(
    combined.map((entry, index) =>
      entry.kind === "manual"
        ? prisma.horaAHoraEvent.update({ where: { id: entry.id }, data: { ordem: index } })
        : prisma.horaAHoraEvent.create({
            data: {
              shootDayId: params.shootDayId,
              horaInicio: entry.event.horaInicio,
              horaFim: entry.event.horaFim,
              descricao: entry.event.descricao,
              tipo: entry.event.tipo,
              geradoAutomaticamente: true,
              ordem: index,
            },
          })
    )
  );

  return NextResponse.json({ generated: generated.length, manualPreserved: manualEvents.length });
}
