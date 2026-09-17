import type { ShotPrioridade, ShotStatus, ShotTipoReset } from "@prisma/client";

import { intercalar, scheduleDaTimeline, separarTimeline, type BlocoNaTimeline } from "@/lib/day-timeline";
import { prisma } from "@/lib/prisma";
import { CREW_CALL_DEPARTMENTS } from "@/lib/report-constants";
import {
  minutesToTime,
  resolveEffectivePrepMin,
  resolveEffectiveRodMin,
  timeToMinutes,
  type ComputedSchedule,
} from "@/lib/schedule";
import {
  descreverOutrasPartes,
  numeroComParte,
  paginasDaEntrada,
  paginasParaOitavos,
  planosDaParte,
  tempoEstimadoDaEntrada,
} from "@/lib/scene-parts-shared";
import { resolveSinopseAD } from "@/lib/scene-sinopse";
import { computeSceneShotTotals, resolveEffectiveResetMin } from "@/lib/shots";
import { formatTimeValue } from "@/lib/time";

export type ShotRow = {
  id: string;
  ordem: number;
  numero: string;
  descricao: string;
  tamanho: string | null;
  lente: string | null;
  angulo: string | null;
  movimento: string | null;
  takesPrevistos: number;
  duracaoTakeMin: number;
  tempoSetupMin: number;
  tempoTotalMin: number;
  /** Já é o valor EFETIVO (ajuste manual do plano, se existir, senão o padrão do projeto — ambos
   *  multiplicados pelo fator do dia, ver resolveEffectiveResetMin em shots-shared.ts). Quem lê
   *  este campo (wizard da OD, PDFs) não precisa saber de fator nem de ajuste manual. */
  tempoResetMin: number | null;
  tipoReset: ShotTipoReset;
  notasDirecao: string | null;
  notasContinuidade: string | null;
  status: ShotStatus;
  prioridade: ShotPrioridade;
  scenePartId: string | null;
};

/** Uma entrada da ordem de filmagem do dia (ShotSchedule) — planos de cenas diferentes podem se
 *  intercalar aqui, ao contrário de `ShotRow` (sempre dentro de uma única cena). Sibling de
 *  `manhaScenes`/`tardeScenes`/`shots`-por-cena no retorno de getShootDayReportData, não aninhado
 *  nelas: representa a sequência do dia cruzando cenas, só populada quando o AD reorganizou os
 *  planos via ShotSchedule (lista vazia = comportamento existente por cena, sem mudanças). */
export type ShotScheduleRow = {
  id: string;
  ordem: number;
  bloco: "MANHA" | "TARDE" | null;
  /** Já efetivo — ver comentário equivalente em ShotRow. */
  tempoResetMin: number | null;
  tipoReset: ShotTipoReset;
  shotId: string;
  sceneId: string;
  sceneNumero: string;
  numero: string;
  descricao: string;
  tamanho: string | null;
  lente: string | null;
  angulo: string | null;
  movimento: string | null;
  takesPrevistos: number;
  duracaoTakeMin: number;
  tempoSetupMin: number;
  tempoTotalMin: number;
  status: ShotStatus;
  prioridade: ShotPrioridade;
};

export type ReportSceneRow = {
  sceneId: string;
  ordem: number;
  bloco: "MANHA" | "TARDE";
  /** O que se EXIBE como número: "19 · Voice off" quando a linha agenda uma parte de cena dividida,
   *  senão "19". Nunca só "19" pra uma parte — a equipe montaria o set de imagem achando que vai
   *  filmar. Não é chave: pra identidade use sceneId; o número puro está em numeroCena. */
  numero: string;
  numeroCena: string;
  /** Parte de cena dividida que esta linha agenda (null = cena inteira). `vinculo` é o outro lado:
   *  "imagem na diária 2". Com parte, paginas/tempoEstimadoMin são os da parte e `shots` traz só os
   *  planos dela + os sem parte. */
  parte: { id: string; rotulo: string; oitavos: number; vinculo: string } | null;
  tipo: "INT" | "EXT" | null;
  periodo: string | null;
  classeLuz: "DIA" | "NOITE" | "TRANSICAO" | "INDEFINIDO";
  set: string | null;
  locacao: string | null;
  /** Id da Locacao vinculada (ou null) — usado pra derivar o prefill de logística da Ordem do Dia. */
  locacaoId: string | null;
  /** "Set" com "Locação" anexada só quando diferem — evita "Restaurante Bananeira · Restaurante Bananeira". */
  setLocacaoDisplay: string;
  sinopse: string | null;
  /** Frase operacional curta do AD (Scene.sinopseAD, cru — sem fallback) — usar `resolveSinopseAD`
   *  quando precisar do valor exibível com fallback pra sinopse truncada. */
  sinopseAD: string | null;
  paginas: string;
  diaNarrativo: number | null;
  tempoEstimadoMin: number | null;
  /** Tempo reverso da AD (Scene.duracaoAlvoMin) — quando existe, manda no Rod da cena. */
  duracaoAlvoMin: number | null;
  prepMin: number | null;
  rodMin: number | null;
  /** Notas operacionais do AD para esta cena NESTA diária (SceneShootDay.observacoes) — diferente de notasAD. */
  observacoes: string | null;
  /** Anotação geral do AD para a cena (Scene.notasAD), visível na Escaleta/Stripboard — não específica de diária. */
  notasAD: string | null;
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "ADIADA";
  horaInicioReal: string | null;
  horaFimReal: string | null;
  schedule: ComputedSchedule | null;
  cast: {
    id: string;
    idCurto: string;
    numeroElenco: number | null;
    personagem: string;
    ator: string | null;
    idadePersonagem: number | null;
  }[];
  extras: { id: string; personagem: string; quantidade: number }[];
  shots: ShotRow[];
  /** Totais de Rod calculados a partir dos planos da cena (null se a cena ainda não tem planos cadastrados). */
  shotsTotal: { planosMin: number; resetsMin: number; totalMin: number; count: number } | null;
  breakdownSheet: {
    figurino: string[];
    make: string[];
    arteDressing: string | null;
    objetos: string[];
    comidaCena: string[];
    microfones: string[];
    trilha: string[];
    habilidades: string[];
    arteGrafica: string[];
    posProducao: string[];
    notasArte: string | null;
    notasFoto: string | null;
    notasSom: string | null;
    notasContinuidade: string | null;
    notasProducao: string | null;
  } | null;
};

export type ReportCastPresente = {
  id: string;
  idCurto: string;
  numeroElenco: number | null;
  personagem: string;
  ator: string | null;
  chamada: string | null;
  camarim: string | null;
  set: string | null;
  saida: string | null;
  /** true quando chamada/camarim/set vieram do fallback automático (sem CharacterCallTime cadastrado). */
  estimado: boolean;
};

export type ReportExtraPresente = {
  id: string;
  personagem: string;
  quantidade: number;
  chamada: string | null;
  saida: string | null;
};

export type HoraAHoraPlanoRow = {
  id: string;
  ordem: number;
  numero: string;
  descricao: string;
  tamanho: string | null;
  lente: string | null;
  movimento: string | null;
  takesPrevistos: number;
  tempoTotalMin: number;
  /** Já efetivo — ver ShotRow. buildHoraAHoraPlanos() só soma o que recebe, não resolve nada. */
  tempoResetMin: number | null;
  tipoReset: ShotTipoReset;
  status: ShotStatus;
  prioridade: ShotPrioridade;
  /** HH acumulado a partir da âncora do bloco — null quando não há âncora de horário calculável. */
  horaInicio: string | null;
};

export type HoraAHoraSceneBlock = {
  sceneId: string;
  numero: string;
  tipo: "INT" | "EXT" | null;
  periodo: ReportSceneRow["periodo"];
  classeLuz: ReportSceneRow["classeLuz"];
  setLocacaoDisplay: string;
  sinopseAD: string;
  cast: ReportSceneRow["cast"];
  planos: HoraAHoraPlanoRow[];
};

/** Agrupa os planos do dia em blocos por cena pra folha "Hora a Hora com Planos" da OD — cada
 *  bloco vira uma caixa com cabeçalho de cena e os planos como sub-itens com HH calculado.
 *  Usa a ordem global (ShotSchedule) quando o AD reorganizou por plano — nesse caso uma cena
 *  retomada mais tarde no dia gera um SEGUNDO bloco, refletindo a retomada real (mesmo critério
 *  de "resumption" já usado no stripboard/alertas da OD). Sem ShotSchedule cadastrado, cai no
 *  fallback: um bloco por cena, na ordem sequencial de manhaScenes+tardeScenes, ancorado no
 *  horário de Rod já calculado da própria cena. */
export type HoraAHoraItem =
  | ({ kind: "cena" } & HoraAHoraSceneBlock)
  | { kind: "bloco"; bloco: BlocoNaTimeline };

function buildHoraAHoraPlanos(
  scenes: ReportSceneRow[],
  shotSchedule: ShotScheduleRow[],
  startTime: string | null,
  blocos: BlocoNaTimeline[]
): HoraAHoraItem[] {
  const sceneById = new Map(scenes.map((s) => [s.sceneId, s]));

  function toHeader(scene: ReportSceneRow): Omit<HoraAHoraSceneBlock, "planos"> {
    return {
      sceneId: scene.sceneId,
      numero: scene.numero,
      tipo: scene.tipo,
      periodo: scene.periodo,
      classeLuz: scene.classeLuz,
      setLocacaoDisplay: scene.setLocacaoDisplay,
      sinopseAD: resolveSinopseAD(scene),
      cast: scene.cast,
    };
  }

  if (shotSchedule.length > 0) {
    const blocks: HoraAHoraItem[] = [];
    let running = startTime ? timeToMinutes(startTime) : null;

    // Bloco de tempo livre entre cenas: o cálculo dos planos não muda (cada plano continua somando
    // reset + tempo), o bloco só empurra o relógio a partir de onde ele está — senão a folha mostraria
    // horário ignorando, por exemplo, 70min de transporte.
    const pendentes = [...blocos].sort((a, b) => a.ordem - b.ordem);
    function emitirBlocosAte(ordemDaCena: number) {
      while (pendentes.length > 0 && pendentes[0].ordem < ordemDaCena) {
        const b = pendentes.shift()!;
        const inicio = running !== null ? minutesToTime(running) : null;
        if (running !== null) running += b.duracaoMin;
        blocks.push({ kind: "bloco", bloco: { ...b, inicio, fim: running !== null ? minutesToTime(running) : null } });
      }
    }

    for (const entry of shotSchedule) {
      const cenaDoPlano = sceneById.get(entry.sceneId);
      if (cenaDoPlano && blocks.every((b) => b.kind !== "cena" || b.sceneId !== entry.sceneId)) {
        emitirBlocosAte(cenaDoPlano.ordem);
      }

      // entry.tempoResetMin é o custo de CHEGAR neste plano (classifyReset(anterior, este) — ver
      // recomputeResetsForOrderedShots em shots-shared.ts), então precisa somar em `running` ANTES
      // de ler o HH deste plano — não depois, o que empurraria o reset pro plano seguinte por
      // engano (mesmo cuidado que ShotSubRows já toma acima, ao contrário de ShotScheduleRows).
      if (running !== null) running += entry.tempoResetMin ?? 0;
      const hh = running !== null ? minutesToTime(running) : null;
      if (running !== null) running += entry.tempoTotalMin;

      const plano: HoraAHoraPlanoRow = {
        id: entry.id,
        ordem: entry.ordem,
        numero: entry.numero,
        descricao: entry.descricao,
        tamanho: entry.tamanho,
        lente: entry.lente,
        movimento: entry.movimento,
        takesPrevistos: entry.takesPrevistos,
        tempoTotalMin: entry.tempoTotalMin,
        tempoResetMin: entry.tempoResetMin,
        tipoReset: entry.tipoReset,
        status: entry.status,
        prioridade: entry.prioridade,
        horaInicio: hh,
      };

      const last = blocks[blocks.length - 1];
      if (last && last.kind === "cena" && last.sceneId === entry.sceneId) {
        last.planos.push(plano);
      } else {
        if (!cenaDoPlano) continue;
        blocks.push({ kind: "cena", ...toHeader(cenaDoPlano), planos: [plano] });
      }
    }
    // Bloco depois do último plano do dia (ex.: transporte de volta).
    emitirBlocosAte(Number.POSITIVE_INFINITY);
    return blocks;
  }

  // Sem ordem por plano: cada caixa é ancorada no Rod já calculado da cena, que JÁ considera os
  // blocos de tempo (ver scheduleDaTimeline) — aqui os blocos só entram na lista, pela ordem.
  const caixas: { ordem: number; item: HoraAHoraItem }[] = scenes
    .filter((scene) => scene.shots.length > 0)
    .map((scene) => {
      let running = scene.schedule ? timeToMinutes(scene.schedule.rodStart) : null;
      const planos: HoraAHoraPlanoRow[] = scene.shots.map((shot) => {
        // Mesmo cuidado do branch acima: soma o reset de CHEGAR neste plano antes de ler o HH.
        if (running !== null) running += shot.tempoResetMin ?? 0;
        const hh = running !== null ? minutesToTime(running) : null;
        if (running !== null) running += shot.tempoTotalMin;
        return {
          id: shot.id,
          ordem: shot.ordem,
          numero: shot.numero,
          descricao: shot.descricao,
          tamanho: shot.tamanho,
          lente: shot.lente,
          movimento: shot.movimento,
          takesPrevistos: shot.takesPrevistos,
          tempoTotalMin: shot.tempoTotalMin,
          tempoResetMin: shot.tempoResetMin,
          tipoReset: shot.tipoReset,
          status: shot.status,
          prioridade: shot.prioridade,
          horaInicio: hh,
        };
      });
      return { ordem: scene.ordem, item: { kind: "cena" as const, ...toHeader(scene), planos } };
    });
  return [...caixas, ...blocos.map((bloco) => ({ ordem: bloco.ordem, item: { kind: "bloco" as const, bloco } }))]
    .sort((a, b) => a.ordem - b.ordem)
    .map((x) => x.item);
}

export type MealCounts = { total: number; cafe: number; almoco: number };

function computeMealCounts(
  people: { chamada: string | null; saida: string | null; quantidade?: number }[],
  blocoManhaInicio: string | null,
  almocoInicio: string | null
): MealCounts {
  const manhaStart = blocoManhaInicio ? timeToMinutes(blocoManhaInicio) : null;
  const almocoStart = almocoInicio ? timeToMinutes(almocoInicio) : null;

  let total = 0;
  let cafe = 0;
  let almoco = 0;

  for (const p of people) {
    const qty = p.quantidade ?? 1;
    total += qty;

    const cafeEligible = !p.chamada || manhaStart === null || timeToMinutes(p.chamada) <= manhaStart;
    if (cafeEligible) cafe += qty;

    const almocoEligible = !p.saida || almocoStart === null || timeToMinutes(p.saida) > almocoStart;
    if (almocoEligible) almoco += qty;
  }

  return { total, cafe, almoco };
}

function sortByArrival<T extends { chamada: string | null }>(people: T[], chamadaGeral: string | null): T[] {
  return [...people].sort((a, b) => {
    const aTime = a.chamada ?? chamadaGeral ?? "99:99";
    const bTime = b.chamada ?? chamadaGeral ?? "99:99";
    return aTime.localeCompare(bTime);
  });
}

/** "Set" com "Locação" anexada só quando diferem — evita "Restaurante Bananeira · Restaurante Bananeira". */
export function formatSetLocacao(set: string | null, locacao: string | null): string {
  return [set, locacao && locacao !== set ? locacao : null].filter(Boolean).join(" · ") || "—";
}

export function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, string>;
}

export async function getShootDayReportData(projectId: string, shootDayId: string) {
  const [project, totalShootDays, shootDay, shotScheduleEntries] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { titulo: true, sigla: true, diretor: true, producao: true, logoUrl: true, sistemaIdElenco: true },
    }),
    prisma.shootDay.count({ where: { projectId } }),
    prisma.shootDay.findFirst({
      where: { id: shootDayId, projectId },
      include: {
        scenes: {
          orderBy: { ordem: "asc" },
          include: {
            scene: {
              include: {
                cast: { include: { character: true } },
                extras: { include: { extra: true } },
                shots: { orderBy: { ordem: "asc" } },
                breakdownSheet: true,
                locacao: { select: { nome: true } },
                parts: {
                  orderBy: { ordem: "asc" },
                  include: { sceneShootDay: { select: { shootDay: { select: { numeroDia: true } } } } },
                },
              },
            },
          },
        },
        callTimes: true,
        blocos: true,
      },
    }),
    prisma.shotSchedule.findMany({
      where: { shootDayId },
      orderBy: { ordem: "asc" },
      include: { shot: { include: { scene: { select: { numero: true } } } } },
    }),
  ]);

  if (!project || !shootDay) return null;

  // Capturado numa const local (em vez de `shootDay.fatorResetPercent` direto) porque toRow() é uma
  // function declaration aninhada — TS não propaga o narrowing de `shootDay` pra dentro dela.
  const fatorResetPercent = shootDay.fatorResetPercent;

  const sceneEntries = shootDay.scenes;
  const manhaEntries = sceneEntries.filter((e) => e.bloco === "MANHA");
  const tardeEntries = sceneEntries.filter((e) => e.bloco === "TARDE");

  const parteDaEntrada = (e: (typeof sceneEntries)[number]) => e.scene.parts.find((p) => p.id === e.scenePartId) ?? null;
  const tempoEstimado = (e: (typeof sceneEntries)[number]) =>
    tempoEstimadoDaEntrada(e.scene.tempoEstimadoMin, paginasParaOitavos(e.scene.paginas), parteDaEntrada(e));

  // Blocos de tempo livres (transporte etc.) ocupam horário entre as cenas: o horário de cada cena
  // é calculado na timeline mista do bloco (manhã/tarde) e depois separado.
  const scheduleDaCena = (e: (typeof sceneEntries)[number]) => ({
    prepMin: resolveEffectivePrepMin(e.prepMin),
    rodMin: resolveEffectiveRodMin(e.rodMin, tempoEstimado(e)),
  });
  const timelineManha = intercalar(manhaEntries, shootDay.blocos.filter((b) => b.bloco === "MANHA"));
  const timelineTarde = intercalar(tardeEntries, shootDay.blocos.filter((b) => b.bloco === "TARDE"));
  const separadoManha = separarTimeline(timelineManha, scheduleDaTimeline(shootDay.blocoManhaInicio, timelineManha, scheduleDaCena));
  const separadoTarde = separarTimeline(timelineTarde, scheduleDaTimeline(shootDay.blocoTardeInicio, timelineTarde, scheduleDaCena));
  const manhaSchedule = separadoManha.cenas.map((c) => c.schedule);
  const tardeSchedule = separadoTarde.cenas.map((c) => c.schedule);
  const blocosDeTempo: BlocoNaTimeline[] = [...separadoManha.blocos, ...separadoTarde.blocos].map((b) => ({
    id: b.id,
    rotulo: b.rotulo,
    duracaoMin: b.duracaoMin,
    ordem: b.ordem,
    bloco: b.bloco,
    inicio: b.inicio,
    fim: b.fim,
  }));

  function toRow(entry: (typeof sceneEntries)[number], schedule: ComputedSchedule | null): ReportSceneRow {
    const scene = entry.scene;
    const parte = parteDaEntrada(entry);
    // Parte: planos dela + sem parte na lista; no total (base do Rod), só os atribuídos a ela.
    const shots = planosDaParte(scene.shots, parte?.id ?? null);
    const planosDoRod = parte ? scene.shots.filter((s) => s.scenePartId === parte.id) : scene.shots;
    const shotsTotal = planosDoRod.length > 0 ? computeSceneShotTotals(planosDoRod) : null;
    return {
      sceneId: scene.id,
      ordem: entry.ordem,
      bloco: entry.bloco,
      numero: numeroComParte(scene.numero, parte),
      numeroCena: scene.numero,
      parte: parte
        ? {
            id: parte.id,
            rotulo: parte.rotulo,
            oitavos: parte.oitavos,
            vinculo: descreverOutrasPartes(
              scene.parts
                .filter((p) => p.id !== parte.id)
                .map((p) => ({ rotulo: p.rotulo, numeroDia: p.sceneShootDay?.shootDay.numeroDia ?? null }))
            ),
          }
        : null,
      tipo: scene.tipo,
      periodo: scene.periodo,
      classeLuz: scene.classeLuz,
      set: scene.set,
      locacao: scene.locacao?.nome ?? null,
      locacaoId: scene.locacaoId,
      setLocacaoDisplay: formatSetLocacao(scene.set, scene.locacao?.nome ?? null),
      sinopse: scene.sinopse,
      sinopseAD: scene.sinopseAD,
      paginas: paginasDaEntrada(Number(scene.paginas), parte).toString(),
      diaNarrativo: scene.diaNarrativo,
      tempoEstimadoMin: tempoEstimado(entry),
      duracaoAlvoMin: scene.duracaoAlvoMin,
      prepMin: entry.prepMin,
      rodMin: entry.rodMin,
      observacoes: entry.observacoes,
      notasAD: scene.notasAD,
      status: entry.status,
      horaInicioReal: entry.horaInicioReal,
      horaFimReal: entry.horaFimReal,
      schedule,
      cast: scene.cast.map((sc) => ({
        id: sc.character.id,
        idCurto: sc.character.idCurto,
        numeroElenco: sc.character.numeroElenco,
        personagem: sc.character.personagem,
        ator: sc.character.ator,
        idadePersonagem: sc.character.idadePersonagem,
      })),
      extras: scene.extras.map((es) => ({
        id: es.extra.id,
        personagem: es.extra.personagem,
        quantidade: es.extra.quantidade,
      })),
      shots: shots.map((shot) => ({
        id: shot.id,
        ordem: shot.ordem,
        numero: shot.numero,
        descricao: shot.descricao,
        tamanho: shot.tamanho,
        lente: shot.lente,
        angulo: shot.angulo,
        movimento: shot.movimento,
        takesPrevistos: shot.takesPrevistos,
        duracaoTakeMin: shot.duracaoTakeMin,
        tempoSetupMin: shot.tempoSetupMin,
        tempoTotalMin: shot.tempoTotalMin,
        tempoResetMin: resolveEffectiveResetMin(shot.tempoResetMin ?? 0, shot.tempoResetMinManual, fatorResetPercent),
        tipoReset: shot.tipoReset,
        notasDirecao: shot.notasDirecao,
        notasContinuidade: shot.notasContinuidade,
        status: shot.status,
        prioridade: shot.prioridade,
        scenePartId: shot.scenePartId,
      })),
      shotsTotal,
      breakdownSheet: scene.breakdownSheet
        ? {
            figurino: scene.breakdownSheet.figurino,
            make: scene.breakdownSheet.make,
            arteDressing: scene.breakdownSheet.arteDressing,
            objetos: scene.breakdownSheet.objetos,
            comidaCena: scene.breakdownSheet.comidaCena,
            microfones: scene.breakdownSheet.microfones,
            trilha: scene.breakdownSheet.trilha,
            habilidades: scene.breakdownSheet.habilidades,
            arteGrafica: scene.breakdownSheet.arteGrafica,
            posProducao: scene.breakdownSheet.posProducao,
            notasArte: scene.breakdownSheet.notasArte,
            notasFoto: scene.breakdownSheet.notasFoto,
            notasSom: scene.breakdownSheet.notasSom,
            notasContinuidade: scene.breakdownSheet.notasContinuidade,
            notasProducao: scene.breakdownSheet.notasProducao,
          }
        : null,
    };
  }

  const manhaScenes = manhaEntries.map((entry, index) => toRow(entry, manhaSchedule[index]));
  const tardeScenes = tardeEntries.map((entry, index) => toRow(entry, tardeSchedule[index]));
  const scenes = [...manhaScenes, ...tardeScenes];

  const totalPaginas = scenes.reduce((sum, s) => sum + Number(s.paginas), 0);

  const castMap = new Map<
    string,
    { id: string; idCurto: string; numeroElenco: number | null; personagem: string; ator: string | null }
  >();
  for (const entry of shootDay.scenes) {
    for (const sc of entry.scene.cast) {
      castMap.set(sc.character.id, {
        id: sc.character.id,
        idCurto: sc.character.idCurto,
        numeroElenco: sc.character.numeroElenco,
        personagem: sc.character.personagem,
        ator: sc.character.ator,
      });
    }
  }
  const callTimeByCharacter = new Map(shootDay.callTimes.map((ct) => [ct.characterId, ct]));

  // Fallback quando não há CharacterCallTime cadastrado: usa o horário de Rod da primeira
  // cena do personagem no dia (a mais cedo) como "Set", e deriva Camarim/Chegada a partir
  // dela. É uma estimativa (marcada como tal no relatório), não substitui um apontamento real.
  const earliestRodStartByCharacter = new Map<string, string>();
  for (const row of scenes) {
    if (!row.schedule) continue;
    for (const c of row.cast) {
      const current = earliestRodStartByCharacter.get(c.id);
      if (!current || timeToMinutes(row.schedule.rodStart) < timeToMinutes(current)) {
        earliestRodStartByCharacter.set(c.id, row.schedule.rodStart);
      }
    }
  }

  const castPresente: ReportCastPresente[] = sortByArrival(
    [...castMap.values()].map((character) => {
      const callTime = callTimeByCharacter.get(character.id);
      if (callTime) {
        return {
          ...character,
          chamada: callTime.chamada,
          camarim: callTime.camarim,
          set: callTime.set,
          saida: callTime.saida,
          estimado: false,
        };
      }

      const earliestRodStart = earliestRodStartByCharacter.get(character.id);
      if (!earliestRodStart) {
        return { ...character, chamada: null, camarim: null, set: null, saida: null, estimado: false };
      }
      const setMin = timeToMinutes(earliestRodStart);
      const camarimMin = setMin - 30;
      const chamadaMin = camarimMin - 15;
      return {
        ...character,
        chamada: minutesToTime(chamadaMin),
        camarim: minutesToTime(camarimMin),
        set: minutesToTime(setMin),
        saida: null,
        estimado: true,
      };
    }),
    shootDay.chamadaGeral
  );

  const extraMap = new Map<string, ReportExtraPresente>();
  for (const entry of shootDay.scenes) {
    for (const es of entry.scene.extras) {
      if (extraMap.has(es.extra.id)) continue;
      extraMap.set(es.extra.id, {
        id: es.extra.id,
        personagem: es.extra.personagem,
        quantidade: es.extra.quantidade,
        chamada: formatTimeValue(es.extra.chamada) || null,
        saida: formatTimeValue(es.extra.saida) || null,
      });
    }
  }
  const extrasPresente: ReportExtraPresente[] = sortByArrival([...extraMap.values()], shootDay.chamadaGeral);

  const castMeals = computeMealCounts(castPresente, shootDay.blocoManhaInicio, shootDay.almocoInicio);
  const extrasMeals = computeMealCounts(extrasPresente, shootDay.blocoManhaInicio, shootDay.almocoInicio);

  // Plano de cena dividida agendado no dia: o rótulo é o da parte que está NESTE dia.
  const numeroExibidoPorCena = new Map(scenes.map((row) => [row.sceneId, row.numero]));
  const shotSchedule: ShotScheduleRow[] = shotScheduleEntries.map((entry) => ({
    id: entry.id,
    ordem: entry.ordem,
    bloco: entry.bloco,
    tempoResetMin: resolveEffectiveResetMin(entry.tempoResetMin ?? 0, entry.tempoResetMinManual, fatorResetPercent),
    tipoReset: entry.tipoReset,
    shotId: entry.shot.id,
    sceneId: entry.shot.sceneId,
    sceneNumero: numeroExibidoPorCena.get(entry.shot.sceneId) ?? entry.shot.scene.numero,
    numero: entry.shot.numero,
    descricao: entry.shot.descricao,
    tamanho: entry.shot.tamanho,
    lente: entry.shot.lente,
    angulo: entry.shot.angulo,
    movimento: entry.shot.movimento,
    takesPrevistos: entry.shot.takesPrevistos,
    duracaoTakeMin: entry.shot.duracaoTakeMin,
    tempoSetupMin: entry.shot.tempoSetupMin,
    tempoTotalMin: entry.shot.tempoTotalMin,
    status: entry.shot.status,
    prioridade: entry.shot.prioridade,
  }));

  const horaAHoraItens = buildHoraAHoraPlanos(
    scenes,
    shotSchedule,
    shootDay.blocoManhaInicio ?? shootDay.chamadaGeral,
    blocosDeTempo
  );
  /** Só as caixas de cena — quem lista plano (Boletim de Continuísmo) não quer bloco de tempo. */
  const horaAHoraPlanos = horaAHoraItens.filter(
    (i): i is { kind: "cena" } & HoraAHoraSceneBlock => i.kind === "cena"
  );

  const chamadaEquipeMap = asStringRecord(shootDay.chamadaEquipe);
  const chamadaEquipeList = CREW_CALL_DEPARTMENTS.map((departamento) => ({
    departamento,
    horario: chamadaEquipeMap[departamento] ?? null,
  }));

  return {
    project,
    totalShootDays,
    shootDay: {
      id: shootDay.id,
      numeroDia: shootDay.numeroDia,
      data: shootDay.data.toISOString(),
      chamadaGeral: shootDay.chamadaGeral,
      lancheHorario: shootDay.lancheHorario,
      // Nível 3 de "tempos de reset configuráveis" — os tempoResetMin acima já vêm com este fator
      // aplicado (ver resolveEffectiveResetMin), mas o valor crú também é exposto pra UI mostrar o
      // aviso "Resets a N%" e a conta no tooltip ("15min × 70% = 11min").
      fatorResetPercent,
      blocoManhaInicio: shootDay.blocoManhaInicio,
      almocoInicio: shootDay.almocoInicio,
      almocoFim: shootDay.almocoFim,
      blocoTardeInicio: shootDay.blocoTardeInicio,
      desprodInicio: shootDay.desprodInicio,
      transporteHorario: shootDay.transporteHorario,
      transporteEndereco: shootDay.transporteEndereco,
      locacaoNome: shootDay.locacaoNome,
      locacaoEndereco: shootDay.locacaoEndereco,
      baseInfo: shootDay.baseInfo,
      estacionamento: shootDay.estacionamento,
      hospitalNome: shootDay.hospitalNome,
      hospitalEndereco: shootDay.hospitalEndereco,
      hospitalTelefone: shootDay.hospitalTelefone,
      meteoNascer: shootDay.meteoNascer,
      meteoPor: shootDay.meteoPor,
      meteoMin: shootDay.meteoMin,
      meteoMax: shootDay.meteoMax,
      meteoChuva: shootDay.meteoChuva,
      meteoDescricao: shootDay.meteoDescricao,
      observacoesGerais: shootDay.observacoesGerais,
      observacaoCronogramaElenco: shootDay.observacaoCronogramaElenco,
      observacaoPlanoSimples: shootDay.observacaoPlanoSimples,
    },
    manhaScenes,
    tardeScenes,
    scenes,
    totalPaginas,
    rodStartManha: manhaSchedule[0]?.rodStart ?? null,
    rodStartTarde: tardeSchedule[0]?.rodStart ?? null,
    castPresente,
    castMeals,
    extrasPresente,
    extrasMeals,
    chamadaEquipeList,
    shotSchedule,
    horaAHoraPlanos,
    /** Caixas da folha "Hora a Hora com Planos": cenas e blocos de tempo, na ordem do dia. */
    horaAHoraItens,
    /** Blocos de tempo livres da diária (não são cena: sem oitavo, elenco, plano) com horário.
     *  Intercalar com as cenas pela `ordem` — ver intercalar() em src/lib/day-timeline.ts. */
    blocosDeTempo,
  };
}

export type ShootDayReportData = NonNullable<Awaited<ReturnType<typeof getShootDayReportData>>>;
