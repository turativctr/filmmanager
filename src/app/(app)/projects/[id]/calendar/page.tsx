import { CalendarBoard } from "@/components/calendar/calendar-board";
import type { CalendarDayData, CalendarMonthSummary } from "@/components/calendar/types";
import { PageHeader } from "@/components/shared/page-header";
import { getMonthGrid, toDateKey } from "@/lib/calendar-grid";
import { prisma } from "@/lib/prisma";

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { month?: string; year?: string };
}) {
  const now = new Date();
  const year = Number(searchParams.year) || now.getUTCFullYear();
  const month = Number(searchParams.month) || now.getUTCMonth() + 1;

  const [project, shootDays, events, characters, tasks] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { titulo: true, sigla: true, sistemaIdElenco: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId: params.id },
      include: {
        scenes: {
          orderBy: { ordem: "asc" },
          include: {
            scene: {
              include: {
                cast: {
                  include: {
                    character: { select: { id: true, idCurto: true, numeroElenco: true, personagem: true } },
                  },
                },
                locacao: { select: { nome: true } },
              },
            },
          },
        },
        callTimes: true,
      },
    }),
    prisma.calendarEvent.findMany({ where: { projectId: params.id } }),
    prisma.character.findMany({
      where: { projectId: params.id },
      orderBy: { idCurto: "asc" },
      select: { id: true, idCurto: true, numeroElenco: true, personagem: true },
    }),
    prisma.task.findMany({ where: { projectId: params.id } }),
  ]);

  const shootDaysByDate = new Map(
    shootDays.map((day) => {
      const firstScene = day.scenes[0]?.scene;
      const totalPaginas = day.scenes.reduce((sum, s) => sum + Number(s.scene.paginas), 0);
      const totalMinutos = day.scenes.reduce((sum, s) => sum + (s.scene.tempoEstimadoMin ?? 0), 0);

      const callTimeByCharacter = new Map(
        day.callTimes.map((ct) => [ct.characterId, { chamada: ct.chamada, saida: ct.saida }])
      );
      const castPresenteMap = new Map<
        string,
        { characterId: string; idCurto: string; numeroElenco: number | null; personagem: string }
      >();
      for (const sceneShootDay of day.scenes) {
        for (const sceneCast of sceneShootDay.scene.cast) {
          castPresenteMap.set(sceneCast.character.id, {
            characterId: sceneCast.character.id,
            idCurto: sceneCast.character.idCurto,
            numeroElenco: sceneCast.character.numeroElenco,
            personagem: sceneCast.character.personagem,
          });
        }
      }

      return [
        toDateKey(day.data),
        {
          id: day.id,
          numeroDia: day.numeroDia,
          set: firstScene?.set ?? null,
          locacao: firstScene?.locacao?.nome ?? null,
          totalPaginas: totalPaginas.toString(),
          totalMinutos,
          scenes: day.scenes.map((s) => ({ numero: s.scene.numero, sinopse: s.scene.sinopse })),
          scenesSemTempoCount: day.scenes.filter((s) => !s.rodMin || s.rodMin === 0).length,
          chamadaGeral: day.chamadaGeral,
          blocoManhaInicio: day.blocoManhaInicio,
          almocoInicio: day.almocoInicio,
          almocoFim: day.almocoFim,
          blocoTardeInicio: day.blocoTardeInicio,
          desprodInicio: day.desprodInicio,
          castPresente: [...castPresenteMap.values()]
            .sort((a, b) => a.idCurto.localeCompare(b.idCurto))
            .map((character) => ({
              ...character,
              chamada: callTimeByCharacter.get(character.characterId)?.chamada ?? null,
              saida: callTimeByCharacter.get(character.characterId)?.saida ?? null,
            })),
        },
      ] as const;
    })
  );

  const eventsByDate = new Map<string, typeof events>();
  for (const event of events) {
    const key = toDateKey(event.data);
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event]);
  }

  const tasksByDate = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const key = toDateKey(task.prazo);
    tasksByDate.set(key, [...(tasksByDate.get(key) ?? []), task]);
  }

  const grid = getMonthGrid(year, month);
  const days: CalendarDayData[] = grid.map(({ date, isCurrentMonth }) => {
    const dateKey = toDateKey(date);
    return {
      dateKey,
      dayNumber: date.getUTCDate(),
      isCurrentMonth,
      shootDay: shootDaysByDate.get(dateKey) ?? null,
      events: (eventsByDate.get(dateKey) ?? []).map((e) => ({
        id: e.id,
        tipo: e.tipo,
        nome: e.nome,
        elementosAfetados: e.elementosAfetados,
      })),
      tasks: (tasksByDate.get(dateKey) ?? []).map((t) => ({
        id: t.id,
        titulo: t.titulo,
        responsavel: t.responsavel,
        concluida: t.concluida,
      })),
    };
  });

  const shootDaysInMonth = shootDays.filter(
    (day) => day.data.getUTCFullYear() === year && day.data.getUTCMonth() === month - 1
  );
  const monthSummary: CalendarMonthSummary = {
    totalDiasFilmagem: shootDaysInMonth.length,
    totalPaginas: shootDaysInMonth
      .reduce((sum, day) => sum + day.scenes.reduce((s, sd) => s + Number(sd.scene.paginas), 0), 0)
      .toString(),
    totalMinutos: shootDaysInMonth.reduce(
      (sum, day) => sum + day.scenes.reduce((s, sd) => s + (sd.scene.tempoEstimadoMin ?? 0), 0),
      0
    ),
    totalCenas: shootDaysInMonth.reduce((sum, day) => sum + day.scenes.length, 0),
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendário"
        help={{
          title: "Calendário",
          description:
            "Visão mensal dos dias de filmagem. Arraste os dias para mudar datas. Adicione eventos como ensaios, viagens e feriados que afetam a produção.",
        }}
      />
      <CalendarBoard
        projectId={params.id}
        year={year}
        month={month}
        days={days}
        characters={characters}
        sistemaIdElenco={project.sistemaIdElenco}
        monthSummary={monthSummary}
        projeto={{ titulo: project.titulo, sigla: project.sigla }}
        responsavelOptions={[...new Set(tasks.map((t) => t.responsavel).filter((r): r is string => Boolean(r)))]}
      />
    </div>
  );
}
