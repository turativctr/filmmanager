import { toDateKey } from "./calendar-grid";
import { prisma } from "./prisma";

export type TerminoForecast =
  | { kind: "agendado"; data: Date; diariasAgendadas: number }
  | { kind: "estimado"; data: Date; cenasNoBoneyard: number };

/** Previsão de término calculada, nunca digitada — `Project.dataFim` continua existindo como
 *  campo manual e é comparado contra esta previsão pela UI (não aqui). "Agendado" quando toda
 *  cena já está numa diária: a previsão é a data da última. "Estimado" quando ainda há cena no
 *  boneyard: projeta `diariasRestantes` dias de filmagem a partir da última diária existente,
 *  pulando datas com CalendarEvent de tipo FOLGA/FERIADO — nunca fins de semana em si, só os dias
 *  marcados como tal. Retorna null quando não há nenhuma diária com cena ainda (não há base pra
 *  estimar um ritmo médio de páginas/diária). */
export async function computeTerminoForecast(projectId: string): Promise<TerminoForecast | null> {
  const [boneyardScenes, shootDaysComCena, skipEvents] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId, omitida: false, shootDays: { none: {} } },
      select: { paginas: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId, scenes: { some: {} } },
      orderBy: { data: "asc" },
      select: { data: true, scenes: { select: { scene: { select: { paginas: true } } } } },
    }),
    prisma.calendarEvent.findMany({
      where: { projectId, tipo: { in: ["FOLGA", "FERIADO"] } },
      select: { data: true },
    }),
  ]);

  if (shootDaysComCena.length === 0) return null;

  const ultimaDiaria = shootDaysComCena[shootDaysComCena.length - 1].data;

  if (boneyardScenes.length === 0) {
    return { kind: "agendado", data: ultimaDiaria, diariasAgendadas: shootDaysComCena.length };
  }

  const paginasAgendadas = shootDaysComCena.reduce(
    (sum, day) => sum + day.scenes.reduce((s, entry) => s + Number(entry.scene.paginas), 0),
    0
  );
  const paginasRestantes = boneyardScenes.reduce((sum, s) => sum + Number(s.paginas), 0);
  const avgPaginasPorDiaria = paginasAgendadas / shootDaysComCena.length;

  // Sem páginas agendadas ainda pra calcular uma média (diárias existem mas ainda vazias de
  // páginas, ex.: só cenas com paginas=0) — não dá pra projetar um ritmo.
  if (avgPaginasPorDiaria <= 0) return null;

  const diariasRestantes = Math.ceil(paginasRestantes / avgPaginasPorDiaria);
  const skipDates = new Set(skipEvents.map((e) => toDateKey(e.data)));

  const cursor = new Date(ultimaDiaria);
  let contadas = 0;
  while (contadas < diariasRestantes) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!skipDates.has(toDateKey(cursor))) contadas++;
  }

  return { kind: "estimado", data: new Date(cursor), cenasNoBoneyard: boneyardScenes.length };
}
