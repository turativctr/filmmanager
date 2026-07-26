import type { ShotStatus } from "@prisma/client";
import { LayoutList } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { InfoBanner } from "@/components/shared/info-banner";
import { StripboardBoard } from "@/components/stripboard/stripboard-board";
import type { BoardState, DayState, SceneSummary, ShotsSummary, StripItem } from "@/components/stripboard/types";
import { Button } from "@/components/ui/button";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";
import { computeSceneShotTotals } from "@/lib/shots";

const shotsSelect = {
  orderBy: { ordem: "asc" as const },
  select: { tempoTotalMin: true, tempoResetMin: true, takesPrevistos: true, status: true },
};

function toShotsSummary(
  shots: {
    tempoTotalMin: number | null;
    tempoResetMin: number | null;
    takesPrevistos: number | null;
    status: ShotStatus;
  }[]
): ShotsSummary | null {
  if (shots.length === 0) return null;
  const totals = computeSceneShotTotals(shots);
  return { count: totals.count, totalMin: totals.totalMin, takesTotal: totals.takesTotal };
}

export default async function StripboardPage({ params }: { params: { id: string } }) {
  const [project, scenes, shootDays, characters] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { titulo: true, sigla: true, sistemaIdElenco: true },
    }),
    prisma.scene.findMany({
      where: { projectId: params.id, omitida: false },
      include: { cast: { select: { characterId: true } }, shots: shotsSelect },
    }),
    prisma.shootDay.findMany({
      where: { projectId: params.id },
      orderBy: { numeroDia: "asc" },
      include: {
        scenes: {
          orderBy: { ordem: "asc" },
          include: {
            scene: { include: { cast: { select: { characterId: true } }, shots: shotsSelect } },
          },
        },
      },
    }),
    prisma.character.findMany({ where: { projectId: params.id } }),
  ]);

  const characterMap = Object.fromEntries(
    characters.map((c) => [c.id, { idCurto: c.idCurto, numeroElenco: c.numeroElenco, personagem: c.personagem }])
  );

  function toSceneSummary(scene: (typeof scenes)[number]): SceneSummary {
    return {
      id: scene.id,
      numero: scene.numero,
      tipo: scene.tipo,
      periodo: scene.periodo,
      set: scene.set,
      locacao: scene.locacao,
      sinopse: scene.sinopse,
      paginas: scene.paginas.toString(),
      diaNarrativo: scene.diaNarrativo,
      tempoEstimadoMin: scene.tempoEstimadoMin,
      notasAD: scene.notasAD,
      omitida: scene.omitida,
      characterIds: scene.cast.map((c) => c.characterId),
    };
  }

  const scheduledSceneIds = new Set(shootDays.flatMap((day) => day.scenes.map((s) => s.sceneId)));

  const boneyard: StripItem[] = scenes
    .filter((scene) => !scheduledSceneIds.has(scene.id))
    .sort((a, b) => naturalCompare(a.numero, b.numero))
    .map((scene) => ({
      sceneId: scene.id,
      prepMin: null,
      rodMin: null,
      scene: toSceneSummary(scene),
      shotsSummary: toShotsSummary(scene.shots),
    }));

  const days: DayState[] = shootDays.map((day) => {
    const manha: StripItem[] = [];
    const tarde: StripItem[] = [];

    for (const entry of day.scenes) {
      const item: StripItem = {
        sceneId: entry.sceneId,
        prepMin: entry.prepMin,
        rodMin: entry.rodMin,
        scene: toSceneSummary(entry.scene),
        shotsSummary: toShotsSummary(entry.scene.shots),
        observacoes: entry.observacoes,
        observacoesAutoGeradas: entry.observacoesAutoGeradas,
      };
      (entry.bloco === "MANHA" ? manha : tarde).push(item);
    }

    return {
      id: day.id,
      numeroDia: day.numeroDia,
      data: day.data.toISOString(),
      chamadaGeral: day.chamadaGeral,
      lancheHorario: day.lancheHorario,
      blocoManhaInicio: day.blocoManhaInicio,
      almocoInicio: day.almocoInicio,
      almocoFim: day.almocoFim,
      blocoTardeInicio: day.blocoTardeInicio,
      desprodInicio: day.desprodInicio,
      manha,
      tarde,
    };
  });

  const board: BoardState = { boneyard, days };

  return (
    <div className="space-y-4">
      <InfoBanner
        storageKey="stripboard"
        title="Stripboard"
        description="O Stripboard organiza as cenas em dias de filmagem. Cada tira colorida representa uma cena — azul para dia, roxo para entardecer, cinza para noite. Arraste para reordenar. As cenas não agendadas ficam no Boneyard."
      />
      {scenes.length === 0 && days.length === 0 ? (
        <EmptyState
          icon={LayoutList}
          title="Nenhuma cena agendada ainda"
          description="Importe seu roteiro ou cadastre as cenas primeiro, depois arraste-as para cá para montar o cronograma de filmagem."
          actions={
            <Button asChild>
              <Link href={`/projects/${params.id}/scenes`}>Ir para Cenas</Link>
            </Button>
          }
        />
      ) : (
        <StripboardBoard
          projectId={params.id}
          initialBoard={board}
          characterMap={characterMap}
          sistemaIdElenco={project.sistemaIdElenco}
          projeto={{ titulo: project.titulo, sigla: project.sigla }}
        />
      )}
    </div>
  );
}
