import { notFound } from "next/navigation";

import { HoraAHoraEditor } from "@/components/ordem-do-dia/hora-a-hora-editor";
import { generateHoraAHoraEvents } from "@/lib/hora-a-hora";
import { prisma } from "@/lib/prisma";
import { getShootDayReportData } from "@/lib/report-data";

export default async function HoraAHoraPage({ params }: { params: { id: string; shootDayId: string } }) {
  const data = await getShootDayReportData(params.id, params.shootDayId);
  if (!data) notFound();

  const existingCount = await prisma.horaAHoraEvent.count({ where: { shootDayId: params.shootDayId } });
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
          shootDayId: params.shootDayId,
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
    where: { shootDayId: params.shootDayId },
    orderBy: { ordem: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Hora a Hora</h2>
        <p className="text-sm text-muted-foreground">
          {data.project.titulo} — Diária {data.shootDay.numeroDia}
        </p>
      </div>
      <HoraAHoraEditor
        projectId={params.id}
        shootDayId={params.shootDayId}
        numeroDia={data.shootDay.numeroDia}
        initialEvents={events.map((e) => ({
          id: e.id,
          horaInicio: e.horaInicio,
          horaFim: e.horaFim,
          descricao: e.descricao,
          tipo: e.tipo,
          geradoAutomaticamente: e.geradoAutomaticamente,
          ordem: e.ordem,
        }))}
      />
    </div>
  );
}
