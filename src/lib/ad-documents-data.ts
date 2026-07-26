import type { CharacterCategoria, SistemaIdElenco } from "@prisma/client";

import { CHARACTER_CATEGORIA_ORDER } from "@/lib/character-categoria";
import { getCharacterId } from "@/lib/character-id";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";
import { formatSetLocacao, getShootDayReportData } from "@/lib/report-data";

type ProjectHeader = {
  titulo: string;
  sigla: string | null;
  diretor: string | null;
  producao: string | null;
  sistemaIdElenco: SistemaIdElenco;
};

async function getProjectHeader(projectId: string): Promise<ProjectHeader> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { titulo: true, sigla: true, diretor: true, producao: true, sistemaIdElenco: true },
  });
  return project;
}

/** Ordena entradas de legenda por ID — numérico quando NUMERACAO, alfanumérico natural quando ID_CURTO. */
function sortByCharacterId<T extends { id: string }>(entries: T[], sistemaIdElenco: SistemaIdElenco): T[] {
  return [...entries].sort((a, b) =>
    sistemaIdElenco === "NUMERACAO" ? Number(a.id) - Number(b.id) : naturalCompare(a.id, b.id)
  );
}

function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

// ---------------------------------------------------------------------------
// 1. Plano semanal de filmagem
// ---------------------------------------------------------------------------

export type WeeklyPlanDay = {
  numeroDia: number;
  data: Date;
  locacaoNome: string | null;
  cenas: {
    numero: string;
    sinopse: string | null;
    paginas: number;
    tempoEstimadoMin: number | null;
    elenco: string[];
  }[];
  elenco: string[];
};
export type WeeklyPlanWeek = { weekStart: Date; days: WeeklyPlanDay[] };
export type WeeklyPlanData = ProjectHeader & { weeks: WeeklyPlanWeek[] };

export async function getWeeklyPlanData(projectId: string): Promise<WeeklyPlanData> {
  const project = await getProjectHeader(projectId);
  const shootDays = await prisma.shootDay.findMany({
    where: { projectId },
    orderBy: { numeroDia: "asc" },
    include: {
      scenes: {
        include: { scene: { include: { cast: { include: { character: true } } } } },
      },
    },
  });

  const days: WeeklyPlanDay[] = shootDays.map((day) => ({
    numeroDia: day.numeroDia,
    data: day.data,
    locacaoNome: day.locacaoNome,
    cenas: day.scenes.map((s) => ({
      numero: s.scene.numero,
      sinopse: s.scene.sinopse,
      paginas: Number(s.scene.paginas),
      tempoEstimadoMin: s.scene.tempoEstimadoMin,
      elenco: s.scene.cast.map((c) => getCharacterId(c.character, project)),
    })),
    elenco: [...new Set(day.scenes.flatMap((s) => s.scene.cast.map((c) => getCharacterId(c.character, project))))],
  }));

  const weekMap = new Map<string, WeeklyPlanWeek>();
  for (const day of days) {
    const weekStart = mondayOf(day.data);
    const key = weekStart.toISOString();
    const week = weekMap.get(key) ?? { weekStart, days: [] };
    week.days.push(day);
    weekMap.set(key, week);
  }

  const weeks = [...weekMap.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  return { ...project, weeks };
}

// ---------------------------------------------------------------------------
// 2. Lista de cenas por ator
// ---------------------------------------------------------------------------

export type ActorSceneListEntry = {
  idCurto: string;
  numeroElenco: number | null;
  personagem: string;
  ator: string | null;
  scenes: { numero: string; locacao: string | null; numeroDia: number | null }[];
};
export type ActorSceneListData = ProjectHeader & { actors: ActorSceneListEntry[] };

export async function getActorSceneListData(projectId: string): Promise<ActorSceneListData> {
  const project = await getProjectHeader(projectId);
  const characters = await prisma.character.findMany({
    where: { projectId },
    orderBy: { idCurto: "asc" },
    include: {
      scenes: {
        include: {
          scene: {
            include: { shootDays: { include: { shootDay: { select: { numeroDia: true } } } } },
          },
        },
      },
    },
  });

  const actors: ActorSceneListEntry[] = characters
    .filter((c) => c.scenes.some((sc) => !sc.scene.omitida))
    .map((c) => ({
      idCurto: c.idCurto,
      numeroElenco: c.numeroElenco,
      personagem: c.personagem,
      ator: c.ator,
      scenes: c.scenes
        .filter((sc) => !sc.scene.omitida)
        .map((sc) => ({
          numero: sc.scene.numero,
          locacao: sc.scene.locacao,
          numeroDia: sc.scene.shootDays[0]?.shootDay.numeroDia ?? null,
        }))
        .sort((a, b) => naturalCompare(a.numero, b.numero)),
    }));

  return { ...project, actors };
}

// ---------------------------------------------------------------------------
// 3. Lista de cenas por locação
// ---------------------------------------------------------------------------

export type LocationSceneListEntry = {
  locacao: string;
  scenes: { numero: string; numeroDia: number | null; elenco: string[] }[];
};
export type LocationSceneListData = ProjectHeader & { locations: LocationSceneListEntry[] };

export async function getLocationSceneListData(projectId: string): Promise<LocationSceneListData> {
  const project = await getProjectHeader(projectId);
  const scenes = await prisma.scene.findMany({
    where: { projectId, omitida: false },
    include: {
      cast: { include: { character: true } },
      shootDays: { include: { shootDay: { select: { numeroDia: true } } } },
    },
  });

  const byLocation = new Map<string, LocationSceneListEntry["scenes"]>();
  for (const scene of scenes) {
    const key = scene.locacao || scene.set || "Sem locação definida";
    const list = byLocation.get(key) ?? [];
    list.push({
      numero: scene.numero,
      numeroDia: scene.shootDays[0]?.shootDay.numeroDia ?? null,
      elenco: scene.cast.map((c) => getCharacterId(c.character, project)),
    });
    byLocation.set(key, list);
  }

  const locations = [...byLocation.entries()]
    .map(([locacao, list]) => ({
      locacao,
      scenes: list.sort((a, b) => naturalCompare(a.numero, b.numero)),
    }))
    .sort((a, b) => a.locacao.localeCompare(b.locacao));

  return { ...project, locations };
}

// ---------------------------------------------------------------------------
// 4. Prestação de contas do elenco
// ---------------------------------------------------------------------------

export type CastAccountingRow = {
  characterId: string;
  idCurto: string;
  numeroElenco: number | null;
  categoria: CharacterCategoria;
  personagem: string;
  ator: string | null;
  cacheeDiario: number | null;
  percentualHold: number | null;
  diasTrabalhados: number;
};
export type CastAccountingData = ProjectHeader & { rows: CastAccountingRow[] };

export async function getCastAccountingData(projectId: string): Promise<CastAccountingData> {
  const project = await getProjectHeader(projectId);
  const characters = await prisma.character.findMany({
    where: { projectId },
    orderBy: { idCurto: "asc" },
    include: {
      scenes: {
        include: { scene: { select: { omitida: true, shootDays: { select: { shootDayId: true } } } } },
      },
    },
  });

  const rows: CastAccountingRow[] = characters
    .map((c) => {
      const shootDayIds = new Set(
        c.scenes
          .filter((sc) => !sc.scene.omitida)
          .flatMap((sc) => sc.scene.shootDays.map((sd) => sd.shootDayId))
      );
      return {
        characterId: c.id,
        idCurto: c.idCurto,
        numeroElenco: c.numeroElenco,
        categoria: c.categoria,
        personagem: c.personagem,
        ator: c.ator,
        cacheeDiario: c.cacheeDiario != null ? Number(c.cacheeDiario) : null,
        percentualHold: c.percentualHold != null ? Number(c.percentualHold) : null,
        diasTrabalhados: shootDayIds.size,
      };
    })
    // Agrupa por categoria (PRINCIPAL primeiro) — a Prestação de Contas exibe uma divisória por grupo.
    .sort(
      (a, b) =>
        CHARACTER_CATEGORIA_ORDER.indexOf(a.categoria) - CHARACTER_CATEGORIA_ORDER.indexOf(b.categoria) ||
        a.idCurto.localeCompare(b.idCurto)
    );

  return { ...project, rows };
}

// ---------------------------------------------------------------------------
// 5. Lista de contatos da equipe
// ---------------------------------------------------------------------------

export type CrewContactRow = {
  id: string;
  nome: string;
  funcao: string;
  departamento: string | null;
  telefone: string | null;
  email: string | null;
};
export type CrewContactListData = ProjectHeader & { crew: CrewContactRow[] };

export async function getCrewContactListData(projectId: string): Promise<CrewContactListData> {
  const project = await getProjectHeader(projectId);
  const crew = await prisma.crewMember.findMany({
    where: { projectId },
    orderBy: [{ departamento: "asc" }, { nome: "asc" }],
  });
  return { ...project, crew };
}

// ---------------------------------------------------------------------------
// 6. Daily Progress Report
// ---------------------------------------------------------------------------

export type DailyProgressReportData = ProjectHeader & {
  shootDay: { numeroDia: number; data: Date };
  report: {
    cenasConcluidas: string[];
    cenasNaoConcluidas: string[];
    paginasFilmadas: number;
    horaInicioReal: string | null;
    horaTerminoReal: string | null;
    atrasoMin: number | null;
    motivoAtraso: string | null;
    observacoes: string | null;
  } | null;
};

export async function getDailyProgressReportData(
  projectId: string,
  shootDayId: string
): Promise<DailyProgressReportData | null> {
  const shootDay = await prisma.shootDay.findFirst({
    where: { id: shootDayId, projectId },
    select: { numeroDia: true, data: true },
  });
  if (!shootDay) return null;

  const project = await getProjectHeader(projectId);
  const report = await prisma.dailyProgressReport.findUnique({ where: { shootDayId } });

  return {
    ...project,
    shootDay,
    report: report
      ? {
          cenasConcluidas: report.cenasConcluidas,
          cenasNaoConcluidas: report.cenasNaoConcluidas,
          paginasFilmadas: Number(report.paginasFilmadas),
          horaInicioReal: report.horaInicioReal,
          horaTerminoReal: report.horaTerminoReal,
          atrasoMin: report.atrasoMin,
          motivoAtraso: report.motivoAtraso,
          observacoes: report.observacoes,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// 7. Notas de continuidade (todas as cenas do projeto)
// ---------------------------------------------------------------------------

export type ContinuityNotesReportData = ProjectHeader & {
  scenes: { numero: string; notes: { texto: string; numeroDia: number | null }[] }[];
};

export async function getContinuityNotesReportData(projectId: string): Promise<ContinuityNotesReportData> {
  const project = await getProjectHeader(projectId);
  const scenes = await prisma.scene.findMany({
    where: { projectId, continuityNotes: { some: {} } },
    include: { continuityNotes: { include: { shootDay: { select: { numeroDia: true } } }, orderBy: { createdAt: "asc" } } },
  });

  return {
    ...project,
    scenes: scenes.map((s) => ({
      numero: s.numero,
      notes: s.continuityNotes.map((n) => ({ texto: n.texto, numeroDia: n.shootDay?.numeroDia ?? null })),
    })),
  };
}

// ---------------------------------------------------------------------------
// 8. Escaleta (referência rápida do projeto inteiro, em ordem narrativa)
// ---------------------------------------------------------------------------

export type EscaletaSceneRow = {
  numero: string;
  tipo: "INT" | "EXT" | null;
  periodo: "DIA" | "NOITE" | "ENTARDECER" | "AMANHECER" | "CONTINUO" | "DEPOIS" | null;
  local: string;
  sinopse: string | null;
  paginas: number;
  personagens: string[];
  notasAD: string | null;
  /** "principal" = branco · "noite" = azul claro · "especial" = amarelo claro (dia fora da locação
   *  principal) · "dia0" = roxo claro (telenovela/devaneio) — cores resolvidas no documento PDF. */
  corCategoria: "principal" | "noite" | "especial" | "dia0";
};

export type EscaletaData = ProjectHeader & {
  legend: { id: string; personagem: string }[];
  scenes: EscaletaSceneRow[];
};

/** Legenda "ID + nome" de todo personagem com ao menos uma cena não-omitida — usada (sempre visível,
 *  independente de NUMERACAO/ID_CURTO) no topo de documentos de projeto inteiro como Escaleta e
 *  Cronograma de Elenco, onde o personagem nunca aparece nomeado por extenso nas tiras de cena. */
async function buildProjectCastLegend(
  projectId: string,
  project: ProjectHeader
): Promise<{ id: string; personagem: string }[]> {
  const characters = await prisma.character.findMany({
    where: { projectId },
    include: { scenes: { include: { scene: true } } },
  });
  return sortByCharacterId(
    characters
      .filter((c) => c.scenes.some((sc) => !sc.scene.omitida))
      .map((c) => ({ id: getCharacterId(c, project), personagem: c.personagem })),
    project.sistemaIdElenco
  );
}

export async function getEscaletaData(projectId: string): Promise<EscaletaData> {
  const project = await getProjectHeader(projectId);
  const legend = await buildProjectCastLegend(projectId, project);

  const scenes = await prisma.scene.findMany({
    where: { projectId, omitida: false },
    include: { cast: { include: { character: true } } },
  });

  // Locação principal = set/locação mais frequente entre as cenas do projeto — heurística para
  // decidir se uma cena de dia é "de rotina" (branco) ou "fora da base" (amarelo, ver spec).
  const locationCounts = new Map<string, number>();
  for (const scene of scenes) {
    const key = formatSetLocacao(scene.set, scene.locacao);
    locationCounts.set(key, (locationCounts.get(key) ?? 0) + 1);
  }
  const mainLocation = [...locationCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const rows: EscaletaSceneRow[] = scenes
    .map((scene) => {
      const local = formatSetLocacao(scene.set, scene.locacao);
      let corCategoria: EscaletaSceneRow["corCategoria"] = "principal";
      if (scene.diaNarrativo === 0) corCategoria = "dia0";
      else if (scene.periodo === "NOITE") corCategoria = "noite";
      else if (scene.periodo === "DIA" && local !== mainLocation) corCategoria = "especial";

      return {
        numero: scene.numero,
        tipo: scene.tipo,
        periodo: scene.periodo,
        local,
        sinopse: scene.sinopse,
        paginas: Number(scene.paginas),
        personagens: scene.cast.map((c) => getCharacterId(c.character, project)),
        notasAD: scene.notasAD,
        corCategoria,
      };
    })
    .sort((a, b) => naturalCompare(a.numero, b.numero));

  return { ...project, legend, scenes: rows };
}

// ---------------------------------------------------------------------------
// 9. Cronograma de Elenco (agrupado por locação/dia, para distribuir a todo o elenco)
// ---------------------------------------------------------------------------

export type CastScheduleSceneStrip = {
  numero: string;
  tipo: "INT" | "EXT" | null;
  periodo: "DIA" | "NOITE" | "ENTARDECER" | "AMANHECER" | "CONTINUO" | "DEPOIS" | null;
  sinopse: string | null;
  personagens: string[];
};

export type CastScheduleSetGroup = { set: string; scenes: CastScheduleSceneStrip[] };

export type CastScheduleCastRow = {
  personagem: string;
  ator: string | null;
  chegada: string | null;
  saida: string | null;
  /** false = horário estimado automaticamente (sem CharacterCallTime cadastrado) — exibir "A DEFINIR". */
  confirmado: boolean;
};

export type CastScheduleDay = {
  shootDayId: string;
  numeroDia: number;
  data: Date;
  locacaoNome: string | null;
  locacaoEndereco: string | null;
  chamadaGeral: string | null;
  desprodInicio: string | null;
  setGroups: CastScheduleSetGroup[];
  cast: CastScheduleCastRow[];
  observacao: string | null;
};

export type CastScheduleData = ProjectHeader & {
  legend: { id: string; personagem: string }[];
  days: CastScheduleDay[];
};

export async function getCastScheduleData(projectId: string): Promise<CastScheduleData> {
  const project = await getProjectHeader(projectId);
  const legend = await buildProjectCastLegend(projectId, project);

  const shootDays = await prisma.shootDay.findMany({
    where: { projectId },
    orderBy: { numeroDia: "asc" },
    select: { id: true, observacaoCronogramaElenco: true },
  });

  const dayReports = await Promise.all(shootDays.map((d) => getShootDayReportData(projectId, d.id)));

  const days: CastScheduleDay[] = [];
  dayReports.forEach((report, i) => {
    if (!report) return;
    const scenes = [...report.manhaScenes, ...report.tardeScenes];

    const setGroupMap = new Map<string, CastScheduleSceneStrip[]>();
    for (const scene of scenes) {
      const list = setGroupMap.get(scene.setLocacaoDisplay) ?? [];
      list.push({
        numero: scene.numero,
        tipo: scene.tipo,
        periodo: scene.periodo,
        sinopse: scene.sinopse,
        personagens: scene.cast.map((c) => getCharacterId(c, project)),
      });
      setGroupMap.set(scene.setLocacaoDisplay, list);
    }

    days.push({
      shootDayId: report.shootDay.id,
      numeroDia: report.shootDay.numeroDia,
      data: new Date(report.shootDay.data),
      locacaoNome: report.shootDay.locacaoNome,
      locacaoEndereco: report.shootDay.locacaoEndereco,
      chamadaGeral: report.shootDay.chamadaGeral,
      desprodInicio: report.shootDay.desprodInicio,
      setGroups: [...setGroupMap.entries()].map(([set, scenes]) => ({ set, scenes })),
      cast: report.castPresente.map((c) => ({
        personagem: c.personagem,
        ator: c.ator,
        chegada: c.chamada,
        saida: c.saida,
        confirmado: !c.estimado,
      })),
      observacao: shootDays[i].observacaoCronogramaElenco,
    });
  });

  return { ...project, legend, days };
}

// ---------------------------------------------------------------------------
// 10. Plano Simplificado para as Diárias (comunicação informal, ex.: WhatsApp)
// ---------------------------------------------------------------------------

export type PlanoSimplesDay = {
  shootDayId: string;
  data: Date;
  locacaoNome: string | null;
  locacaoEndereco: string | null;
  observacao: string | null;
  scenesNumeros: string[];
  setsDescricao: string;
};

export type PlanoSimplesData = ProjectHeader & { days: PlanoSimplesDay[] };

export async function getPlanoSimplesData(projectId: string): Promise<PlanoSimplesData> {
  const project = await getProjectHeader(projectId);

  const shootDays = await prisma.shootDay.findMany({
    where: { projectId },
    orderBy: { data: "asc" },
    include: {
      scenes: { include: { scene: true }, orderBy: { ordem: "asc" } },
    },
  });

  const days: PlanoSimplesDay[] = shootDays.map((day) => {
    const scenes = day.scenes.map((s) => s.scene).filter((s) => !s.omitida);
    const sets = [...new Set(scenes.map((s) => formatSetLocacao(s.set, s.locacao)))].filter((s) => s !== "—");

    return {
      shootDayId: day.id,
      data: day.data,
      locacaoNome: day.locacaoNome,
      locacaoEndereco: day.locacaoEndereco,
      observacao: day.observacaoPlanoSimples,
      scenesNumeros: [...scenes.map((s) => s.numero)].sort(naturalCompare),
      setsDescricao: sets.join(", "),
    };
  });

  return { ...project, days };
}
