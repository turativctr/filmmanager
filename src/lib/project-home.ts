import type { Task } from "@prisma/client";

import { computeTerminoForecast, type TerminoForecast } from "./project-forecast";
import { prisma } from "./prisma";

/** Meia-noite UTC de hoje — mesma convenção usada por `ShootDay.data`/`CalendarEvent.data`
 *  (strings "yyyy-mm-dd" parseadas como `new Date(...)` caem em meia-noite UTC), então comparar
 *  contra isso bate exatamente com o dia calendário, sem depender do fuso do servidor. */
export function todayUTCMidnight(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

export type TaskRow = Pick<Task, "id" | "titulo" | "prazo" | "responsavel">;

async function getUpcomingTasks(projectId: string): Promise<TaskRow[]> {
  const em14Dias = new Date();
  em14Dias.setDate(em14Dias.getDate() + 14);

  return prisma.task.findMany({
    where: { projectId, concluida: false, prazo: { lte: em14Dias } },
    orderBy: { prazo: "asc" },
    select: { id: true, titulo: true, prazo: true, responsavel: true },
  });
}

async function getEventosProximos(projectId: string, hoje: Date) {
  const em7Dias = new Date(hoje);
  em7Dias.setUTCDate(em7Dias.getUTCDate() + 7);

  return prisma.calendarEvent.findMany({
    where: { projectId, data: { gte: hoje, lte: em7Dias } },
    orderBy: { data: "asc" },
  });
}

export type ProjectHomeState =
  | { kind: "A" }
  | {
      kind: "B";
      totalCenas: number;
      totalPaginas: number;
      totalTempoMin: number;
      totalLocacoes: number;
      tarefas: TaskRow[];
    }
  | {
      kind: "C";
      proximaDiaria: { numeroDia: number; data: Date; diasRestantes: number; label: string | null } | null;
      forecast: TerminoForecast | null;
      progresso: { cenasConcluidas: number; totalCenas: number; paginasConcluidas: number; totalPaginas: number };
      tarefas: TaskRow[];
      eventos: { id: string; nome: string; tipo: string; data: Date }[];
    }
  | {
      kind: "D";
      shootDay: { id: string; numeroDia: number; locacaoNome: string | null; chamadaGeral: string | null };
      scenes: { sceneId: string; numero: string; status: string }[];
      tarefasAtrasadas: TaskRow[];
      eventos: { id: string; nome: string; tipo: string; data: Date }[];
    };

export async function getProjectHomeState(projectId: string): Promise<ProjectHomeState> {
  const totalCenas = await prisma.scene.count({ where: { projectId, omitida: false } });
  if (totalCenas === 0) return { kind: "A" };

  const shootDaysComCena = await prisma.shootDay.count({ where: { projectId, scenes: { some: {} } } });
  if (shootDaysComCena === 0) {
    const [scenes, totalLocacoes, tarefas] = await Promise.all([
      prisma.scene.findMany({
        where: { projectId, omitida: false },
        select: { paginas: true, tempoEstimadoMin: true },
      }),
      prisma.locacao.count({ where: { projectId, scenes: { some: {} } } }),
      getUpcomingTasks(projectId),
    ]);
    return {
      kind: "B",
      totalCenas,
      totalPaginas: scenes.reduce((sum, s) => sum + Number(s.paginas), 0),
      totalTempoMin: scenes.reduce((sum, s) => sum + (s.tempoEstimadoMin ?? 0), 0),
      totalLocacoes,
      tarefas,
    };
  }

  const hoje = todayUTCMidnight();

  const todayShootDay = await prisma.shootDay.findFirst({
    where: { projectId, data: hoje },
    include: { scenes: { orderBy: { ordem: "asc" }, include: { scene: { select: { numero: true } } } } },
  });

  if (todayShootDay) {
    const [tarefasAtrasadas, eventos] = await Promise.all([
      prisma.task.findMany({
        where: { projectId, concluida: false, prazo: { lt: hoje } },
        orderBy: { prazo: "asc" },
        select: { id: true, titulo: true, prazo: true, responsavel: true },
      }),
      getEventosProximos(projectId, hoje),
    ]);

    return {
      kind: "D",
      shootDay: {
        id: todayShootDay.id,
        numeroDia: todayShootDay.numeroDia,
        locacaoNome: todayShootDay.locacaoNome,
        chamadaGeral: todayShootDay.chamadaGeral,
      },
      scenes: todayShootDay.scenes.map((s) => ({ sceneId: s.sceneId, numero: s.scene.numero, status: s.status })),
      tarefasAtrasadas,
      eventos: eventos.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo, data: e.data })),
    };
  }

  const [proximaDiariaRow, forecast, todasCenas, concluidas, tarefas, eventos] = await Promise.all([
    prisma.shootDay.findFirst({
      where: { projectId, data: { gte: hoje } },
      orderBy: { data: "asc" },
      include: {
        scenes: { take: 1, orderBy: { ordem: "asc" }, include: { scene: { select: { set: true } } } },
      },
    }),
    computeTerminoForecast(projectId),
    prisma.scene.findMany({ where: { projectId, omitida: false }, select: { id: true, paginas: true } }),
    prisma.sceneShootDay.findMany({
      where: { shootDay: { projectId }, status: "CONCLUIDA" },
      select: { sceneId: true },
      distinct: ["sceneId"],
    }),
    getUpcomingTasks(projectId),
    getEventosProximos(projectId, hoje),
  ]);

  const concluidaIds = new Set(concluidas.map((c) => c.sceneId));
  const paginasConcluidas = todasCenas
    .filter((s) => concluidaIds.has(s.id))
    .reduce((sum, s) => sum + Number(s.paginas), 0);
  const totalPaginas = todasCenas.reduce((sum, s) => sum + Number(s.paginas), 0);

  const proximaDiaria = proximaDiariaRow
    ? {
        numeroDia: proximaDiariaRow.numeroDia,
        data: proximaDiariaRow.data,
        diasRestantes: Math.round((proximaDiariaRow.data.getTime() - hoje.getTime()) / 86_400_000),
        label: proximaDiariaRow.locacaoNome ?? proximaDiariaRow.scenes[0]?.scene.set ?? null,
      }
    : null;

  return {
    kind: "C",
    proximaDiaria,
    forecast,
    progresso: {
      cenasConcluidas: concluidaIds.size,
      totalCenas: todasCenas.length,
      paginasConcluidas,
      totalPaginas,
    },
    tarefas,
    eventos: eventos.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo, data: e.data })),
  };
}
