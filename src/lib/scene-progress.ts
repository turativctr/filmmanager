import { minutesToTime, timeToMinutes } from "@/lib/schedule";

export type SceneShootDayStatusValue = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "ADIADA";

export type SceneProgressInput = {
  paginas: number;
  status: SceneShootDayStatusValue;
};

export type DayProgressEstimate = {
  paginasPorHora: number;
  horarioEstimadoTermino: string;
  horarioPlanejado: string | null;
  deltaMin: number | null;
};

export type DayProgressResult = {
  totalCenas: number;
  cenasConcluidas: number;
  cenasEmAndamento: number;
  cenasAdiadas: number;
  paginasTotais: number;
  paginasConcluidas: number;
  paginasRestantes: number;
  percentualConcluido: number;
  estimativa: DayProgressEstimate | null;
};

export type DayProgressParams = {
  chamadaGeral: string | null;
  desprodInicio: string | null;
  /** Minutos desde a meia-noite, no horário atual — `null` quando a diária não é hoje. */
  nowMin: number | null;
};

export function computeDayProgress(scenes: SceneProgressInput[], params: DayProgressParams): DayProgressResult {
  const totalCenas = scenes.length;
  const cenasConcluidas = scenes.filter((s) => s.status === "CONCLUIDA").length;
  const cenasEmAndamento = scenes.filter((s) => s.status === "EM_ANDAMENTO").length;
  const cenasAdiadas = scenes.filter((s) => s.status === "ADIADA").length;

  const paginasTotais = scenes.reduce((sum, s) => sum + s.paginas, 0);
  const paginasConcluidas = scenes
    .filter((s) => s.status === "CONCLUIDA")
    .reduce((sum, s) => sum + s.paginas, 0);
  const paginasRestantes = scenes
    .filter((s) => s.status !== "CONCLUIDA" && s.status !== "ADIADA")
    .reduce((sum, s) => sum + s.paginas, 0);
  const percentualConcluido = paginasTotais > 0 ? Math.round((paginasConcluidas / paginasTotais) * 100) : 0;

  let estimativa: DayProgressEstimate | null = null;
  if (params.nowMin != null && params.chamadaGeral) {
    const elapsedMin = params.nowMin - timeToMinutes(params.chamadaGeral);
    if (elapsedMin > 0 && paginasConcluidas > 0) {
      const paginasPorMin = paginasConcluidas / elapsedMin;
      const remainingMin = paginasRestantes > 0 ? paginasRestantes / paginasPorMin : 0;
      const horarioEstimadoTerminoMin = Math.round(params.nowMin + remainingMin);
      const deltaMin = params.desprodInicio
        ? horarioEstimadoTerminoMin - timeToMinutes(params.desprodInicio)
        : null;

      estimativa = {
        paginasPorHora: Math.round(paginasPorMin * 60 * 1000) / 1000,
        horarioEstimadoTermino: minutesToTime(horarioEstimadoTerminoMin),
        horarioPlanejado: params.desprodInicio,
        deltaMin,
      };
    }
  }

  return {
    totalCenas,
    cenasConcluidas,
    cenasEmAndamento,
    cenasAdiadas,
    paginasTotais,
    paginasConcluidas,
    paginasRestantes,
    percentualConcluido,
    estimativa,
  };
}

/** Compara a data da diária com a data atual (ambas truncadas para o dia) para decidir se a estimativa de ritmo é aplicável. */
export function isShootDayToday(shootDayData: Date, now: Date): boolean {
  return (
    shootDayData.getFullYear() === now.getFullYear() &&
    shootDayData.getMonth() === now.getMonth() &&
    shootDayData.getDate() === now.getDate()
  );
}
