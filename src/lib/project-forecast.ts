import { toDateKey } from "./calendar-grid";
import { prisma } from "./prisma";
import { paginasDaEntrada } from "./scene-parts-shared";

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
  const [cenas, shootDaysComCena, skipEvents] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId, omitida: false },
      select: {
        paginas: true,
        shootDays: { select: { id: true } },
        parts: { select: { oitavos: true, sceneShootDay: { select: { id: true } } } },
      },
    }),
    prisma.shootDay.findMany({
      where: { projectId, scenes: { some: {} } },
      orderBy: { data: "asc" },
      select: {
        data: true,
        scenes: { select: { scene: { select: { paginas: true } }, scenePart: { select: { oitavos: true } } } },
      },
    }),
    prisma.calendarEvent.findMany({
      where: { projectId, tipo: { in: ["FOLGA", "FERIADO"] } },
      select: { data: true },
    }),
  ]);

  if (shootDaysComCena.length === 0) return null;

  const ultimaDiaria = shootDaysComCena[shootDaysComCena.length - 1].data;

  // "Boneyard" em páginas: cena inteira sem diária, e cada parte ainda sem diária de cena dividida
  // (pelos oitavos da parte — a outra parte já agendada não conta de novo).
  const paginasPendentes = cenas.flatMap((c) =>
    c.parts.length === 0
      ? c.shootDays.length === 0
        ? [Number(c.paginas)]
        : []
      : c.parts.filter((p) => !p.sceneShootDay).map((p) => p.oitavos / 8)
  );

  if (paginasPendentes.length === 0) {
    return { kind: "agendado", data: ultimaDiaria, diariasAgendadas: shootDaysComCena.length };
  }

  const paginasAgendadas = shootDaysComCena.reduce(
    (sum, day) =>
      sum + day.scenes.reduce((s, entry) => s + paginasDaEntrada(Number(entry.scene.paginas), entry.scenePart), 0),
    0
  );
  const paginasRestantes = paginasPendentes.reduce((sum, p) => sum + p, 0);
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

  return { kind: "estimado", data: new Date(cursor), cenasNoBoneyard: paginasPendentes.length };
}
