import { notFound } from "next/navigation";

import { ShootDayDashboard } from "@/components/ordem-do-dia/dashboard";
import { getCharacterId } from "@/lib/character-id";
import { detectSceneConflicts } from "@/lib/conflicts";
import {
  aggregateComidaCena,
  aggregateMake,
  detectQuickChanges,
  generateChecklistItems,
} from "@/lib/ordem-do-dia";
import { prisma } from "@/lib/prisma";
import { getShootDayReportData } from "@/lib/report-data";
import { minutosEmBlocos } from "@/lib/day-timeline";
import { timeToMinutes } from "@/lib/schedule";
import { computeCortaveisMin } from "@/lib/shots-shared";

export default async function ShootDayPage({
  params,
}: {
  params: { id: string; shootDayId: string };
}) {
  const data = await getShootDayReportData(params.id, params.shootDayId);
  if (!data) notFound();

  const characters = data.castPresente.map((c) => ({
    id: c.id,
    idCurto: c.idCurto,
    numeroElenco: c.numeroElenco,
    personagem: c.personagem,
  }));

  const existingCount = await prisma.shootDayChecklist.count({ where: { shootDayId: params.shootDayId } });
  if (existingCount === 0) {
    const generated = generateChecklistItems({
      locacaoNome: data.shootDay.locacaoNome,
      transporteHorario: data.shootDay.transporteHorario,
      transporteEndereco: data.shootDay.transporteEndereco,
      castPresente: data.castPresente,
      scenes: data.scenes,
      characters,
    });
    if (generated.length > 0) {
      await prisma.shootDayChecklist.createMany({
        data: generated.map((g) => ({
          shootDayId: params.shootDayId,
          item: g.item,
          tipo: g.tipo,
          geradoAutomaticamente: true,
        })),
      });
    }
  }

  const checklist = await prisma.shootDayChecklist.findMany({
    where: { shootDayId: params.shootDayId },
    orderBy: [{ tipo: "asc" }, { createdAt: "asc" }],
  });

  const dailyProgressReport = await prisma.dailyProgressReport.findUnique({
    where: { shootDayId: params.shootDayId },
  });

  // Modo simplificado: teto e modo da diária + a Jornada do projeto (preparação inicial e almoço),
  // que entram na conta do fim previsto igual ao que recalculateDayBlocks grava.
  const [planejamento, jornadaProjeto] = await Promise.all([
    prisma.shootDay.findUniqueOrThrow({
      where: { id: params.shootDayId },
      select: { jornadaMin: true, horaFimAlvo: true, modoPlanejamento: true },
    }),
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { limiteAlmocoMin: true, duracaoAlmocoMin: true, preparacaoInicialMin: true },
    }),
  ]);

  const conflictInputs = data.scenes
    .filter((s) => s.schedule)
    .map((s) => ({
      sceneId: s.sceneId,
      numero: s.numero,
      characterIds: s.cast.map((c) => c.id),
      rodStartMin: timeToMinutes(s.schedule!.rodStart),
      rodEndMin: timeToMinutes(s.schedule!.rodEnd),
    }));
  const conflictsBySceneId = detectSceneConflicts(conflictInputs, (id) => {
    const character = characters.find((c) => c.id === id);
    return character ? getCharacterId(character, data.project) : id;
  });
  const castConflicts = [...new Set([...conflictsBySceneId.values()].flat())];

  const quickChanges = detectQuickChanges(data.scenes, characters);
  const makeEspeciais = aggregateMake(data.scenes, characters).filter((m) => m.especial);
  const comidaCena = aggregateComidaCena(data.scenes);
  const habilidadesPendentes = checklist.filter((c) => c.tipo === "ELENCO" && !c.confirmado && c.geradoAutomaticamente);
  const notasPosProducao = data.scenes.flatMap((s) => s.breakdownSheet?.posProducao ?? []);

  const totalPessoas = new Set(data.scenes.flatMap((s) => s.cast.map((c) => c.id))).size;

  const timelineBlocks: { label: string; startMin: number; durationMin: number; kind: "scene" | "pause" | "bloco" }[] = [];
  for (const bloco of data.blocosDeTempo) {
    if (!bloco.inicio) continue;
    timelineBlocks.push({ label: bloco.rotulo, startMin: timeToMinutes(bloco.inicio), durationMin: bloco.duracaoMin, kind: "bloco" });
  }
  for (const scene of data.scenes) {
    if (!scene.schedule) continue;
    const startMin = timeToMinutes(scene.schedule.prepStart);
    const endMin = timeToMinutes(scene.schedule.rodEnd);
    timelineBlocks.push({
      label: `Cena ${scene.numero}`,
      startMin,
      durationMin: endMin - startMin,
      kind: "scene",
    });
  }
  if (data.shootDay.almocoInicio && data.shootDay.almocoFim) {
    timelineBlocks.push({
      label: "Almoço",
      startMin: timeToMinutes(data.shootDay.almocoInicio),
      durationMin: timeToMinutes(data.shootDay.almocoFim) - timeToMinutes(data.shootDay.almocoInicio),
      kind: "pause",
    });
  }
  timelineBlocks.sort((a, b) => a.startMin - b.startMin);

  return (
    <ShootDayDashboard
      projectId={params.id}
      sistemaIdElenco={data.project.sistemaIdElenco}
      projeto={{ titulo: data.project.titulo, sigla: data.project.sigla }}
      shootDay={{
        id: data.shootDay.id,
        numeroDia: data.shootDay.numeroDia,
        data: data.shootDay.data,
        chamadaGeral: data.shootDay.chamadaGeral,
        desprodInicio: data.shootDay.desprodInicio,
        locacaoNome: data.shootDay.locacaoNome,
      }}
      totalCenas={data.scenes.length}
      totalPaginas={data.totalPaginas}
      totalMinutos={data.scenes.reduce((sum, s) => sum + (s.tempoEstimadoMin ?? 0), 0)}
      blocosMin={minutosEmBlocos(data.blocosDeTempo)}
      // Parte de cena dividida: só os planos atribuídos a ela (mesma regra do Rod da parte).
      cortaveisMin={data.scenes.reduce(
        (sum, s) => sum + computeCortaveisMin(s.parte ? s.shots.filter((sh) => sh.scenePartId === s.parte!.id) : s.shots),
        0
      )}
      totalPessoas={totalPessoas}
      timelineBlocks={timelineBlocks}
      alerts={{
        castConflicts,
        quickChanges,
        makeEspeciais,
        comidaCena,
        habilidadesPendentesCount: habilidadesPendentes.length,
        notasPosProducao,
      }}
      checklist={checklist.map((c) => ({
        id: c.id,
        item: c.item,
        confirmado: c.confirmado,
        tipo: c.tipo,
        geradoAutomaticamente: c.geradoAutomaticamente,
      }))}
      scheduledScenes={data.scenes.map((s) => ({ numero: s.numero, paginas: Number(s.paginas) }))}
      sceneProgress={data.scenes.map((s) => ({
        sceneId: s.sceneId,
        numero: s.numero,
        paginas: Number(s.paginas),
        status: s.status,
        horaInicioReal: s.horaInicioReal,
        horaFimReal: s.horaFimReal,
      }))}
      modoPlanejamento={planejamento.modoPlanejamento}
      simplificado={{
        chamadaGeral: data.shootDay.chamadaGeral,
        desprodInicio: data.shootDay.desprodInicio,
        config: jornadaProjeto,
        teto: { jornadaMin: planejamento.jornadaMin, horaFimAlvo: planejamento.horaFimAlvo },
        // prep/Rod CRUS de SceneShootDay — a tela aplica o mesmo fallback da OD na conta.
        cenas: data.scenes.map((s) => ({
          sceneId: s.sceneId,
          scenePartId: s.parte?.id ?? null,
          ordem: s.ordem,
          bloco: s.bloco,
          numero: s.numero,
          local: s.setLocacaoDisplay,
          prepMin: s.prepMin,
          rodMin: s.rodMin,
          tempoEstimadoMin: s.tempoEstimadoMin,
        })),
        blocos: data.blocosDeTempo.map((b) => ({
          id: b.id,
          rotulo: b.rotulo,
          duracaoMin: b.duracaoMin,
          ordem: b.ordem,
          bloco: b.bloco,
        })),
      }}
      initialDailyProgressReport={
        dailyProgressReport
          ? {
              cenasConcluidas: dailyProgressReport.cenasConcluidas,
              paginasFilmadas: Number(dailyProgressReport.paginasFilmadas),
              horaInicioReal: dailyProgressReport.horaInicioReal,
              horaTerminoReal: dailyProgressReport.horaTerminoReal,
              atrasoMin: dailyProgressReport.atrasoMin,
              motivoAtraso: dailyProgressReport.motivoAtraso,
              observacoes: dailyProgressReport.observacoes,
            }
          : null
      }
    />
  );
}
