import type { ShotPrioridade, ShotStatus } from "@prisma/client";
import { LayoutList } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { NextStepFooter } from "@/components/shared/next-step-footer";
import { PageHeader } from "@/components/shared/page-header";
import { StripboardBoard } from "@/components/stripboard/stripboard-board";
import type { BoardState, DayState, SceneSummary, ShotsSummary, StripItem } from "@/components/stripboard/types";
import { Button } from "@/components/ui/button";
import { deriveClasseLuz } from "@/lib/fdx-parser";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";
import { resolveEffectivePrepMin, resolveEffectiveRodMin, suggestAlmocoIndex } from "@/lib/schedule";
import {
  divisaoNaoFecha,
  mensagemDivisaoNaoFecha,
  minutosEmPlanosSemParte,
  paginasParaOitavos,
  planosDaParte,
  resolveRodDaParte,
  tempoEstimadoDaEntrada,
} from "@/lib/scene-parts-shared";
import { computeSceneShotTotals } from "@/lib/shots";
import { computeCortaveisMin } from "@/lib/shots-shared";

const shotsSelect = {
  orderBy: { ordem: "asc" as const },
  select: {
    tempoTotalMin: true,
    tempoResetMin: true,
    tempoResetMinManual: true,
    takesPrevistos: true,
    status: true,
    prioridade: true,
    scenePartId: true,
  },
};

const partsInclude = {
  orderBy: { ordem: "asc" as const },
  include: { sceneShootDay: { select: { shootDay: { select: { numeroDia: true } } } } },
};

type ShotParaResumo = {
  tempoTotalMin: number | null;
  tempoResetMin: number | null;
  tempoResetMinManual: number | null;
  takesPrevistos: number | null;
  status: ShotStatus;
  prioridade: ShotPrioridade;
};

function toShotsSummary(
  shots: ShotParaResumo[],
  /** Planos que valem pro tempo: numa parte, só os atribuídos a ela (os sem parte aparecem na lista
   *  mas não entram no Rod nem nos cortáveis — senão contariam em toda diária da cena). */
  planosDoTempo: ShotParaResumo[] = shots
): ShotsSummary | null {
  if (shots.length === 0) return null;
  const totals = computeSceneShotTotals(shots);
  return {
    count: totals.count,
    totalMin: computeSceneShotTotals(planosDoTempo).totalMin,
    takesTotal: totals.takesTotal,
    cortaveisMin: computeCortaveisMin(planosDoTempo),
  };
}


export default async function StripboardPage({ params }: { params: { id: string } }) {
  const [project, scenes, shootDays, characters] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { titulo: true, sigla: true, sistemaIdElenco: true, limiteAlmocoMin: true, duracaoAlmocoMin: true },
    }),
    prisma.scene.findMany({
      where: { projectId: params.id, omitida: false },
      include: {
        cast: { select: { characterId: true } },
        shots: shotsSelect,
        locacao: { select: { nome: true } },
        parts: partsInclude,
        shootDays: { select: { scenePartId: true } },
      },
    }),
    prisma.shootDay.findMany({
      where: { projectId: params.id },
      orderBy: { numeroDia: "asc" },
      include: {
        scenes: {
          orderBy: { ordem: "asc" },
          include: {
            scene: {
              include: {
                cast: { select: { characterId: true } },
                shots: shotsSelect,
                locacao: { select: { nome: true } },
                parts: partsInclude,
              },
            },
          },
        },
      },
    }),
    prisma.character.findMany({ where: { projectId: params.id } }),
  ]);

  const characterMap = Object.fromEntries(
    characters.map((c) => [c.id, { idCurto: c.idCurto, numeroElenco: c.numeroElenco, personagem: c.personagem }])
  );

  type SceneComPartes = Omit<(typeof scenes)[number], "shootDays">;
  type Parte = SceneComPartes["parts"][number];

  function toSceneSummary(scene: SceneComPartes): SceneSummary {
    // classeLuzFim só importa pra cena em TRANSICAO (decide a direção do degradê na tira — ver
    // strip-card.tsx); pra qualquer outra classe fica null, sem custo de calcular à toa.
    const classeLuzFim =
      scene.classeLuz === "TRANSICAO" && scene.periodoFim ? deriveClasseLuz(scene.periodoFim).classeLuz : null;
    return {
      id: scene.id,
      numero: scene.numero,
      tipo: scene.tipo,
      periodo: scene.periodo,
      classeLuz: scene.classeLuz,
      classeLuzFim: classeLuzFim === "DIA" || classeLuzFim === "NOITE" ? classeLuzFim : null,
      set: scene.set,
      locacao: scene.locacao?.nome ?? null,
      sinopse: scene.sinopse,
      paginas: scene.paginas.toString(),
      diaNarrativo: scene.diaNarrativo,
      tempoEstimadoMin: scene.tempoEstimadoMin,
      duracaoAlvoMin: scene.duracaoAlvoMin,
      notasAD: scene.notasAD,
      omitida: scene.omitida,
      characterIds: scene.cast.map((c) => c.characterId),
      divisaoNaoFecha: divisaoNaoFecha(paginasParaOitavos(scene.paginas), scene.parts)
        ? mensagemDivisaoNaoFecha(paginasParaOitavos(scene.paginas), scene.parts)
        : null,
    };
  }

  /** Tira de uma cena inteira ou de UMA parte dela. Parte mostra só os planos dela + os sem parte. */
  function toStripItem(scene: SceneComPartes, parte: Parte | null): StripItem {
    const oitavosCena = paginasParaOitavos(scene.paginas);
    const rodDaParte = parte
      ? resolveRodDaParte({
          parteId: parte.id,
          oitavosParte: parte.oitavos,
          oitavosCena,
          tempoEstimadoCenaMin: scene.tempoEstimadoMin,
          planos: scene.shots,
        })
      : null;
    return {
      itemId: parte?.id ?? scene.id,
      sceneId: scene.id,
      scenePartId: parte?.id ?? null,
      parte:
        parte && rodDaParte
          ? {
              id: parte.id,
              rotulo: parte.rotulo,
              oitavos: parte.oitavos,
              outras: scene.parts
                .filter((p) => p.id !== parte.id)
                .map((p) => ({ rotulo: p.rotulo, numeroDia: p.sceneShootDay?.shootDay.numeroDia ?? null })),
              rodMin: rodDaParte.rodMin,
              fonteRod: rodDaParte.fonte,
              minSemParte: minutosEmPlanosSemParte(scene.shots),
              tempoEstimadoMin: tempoEstimadoDaEntrada(scene.tempoEstimadoMin, oitavosCena, parte),
              todas: scene.parts.map((p) => ({ id: p.id, rotulo: p.rotulo, oitavos: p.oitavos })),
              oitavosCena,
            }
          : null,
      prepMin: null,
      rodMin: null,
      scene: toSceneSummary(scene),
      shotsSummary: toShotsSummary(
        planosDaParte(scene.shots, parte?.id ?? null),
        parte ? scene.shots.filter((s) => s.scenePartId === parte.id) : scene.shots
      ),
    };
  }

  // Boneyard: cena inteira que não está em diária nenhuma, e cada PARTE ainda não alocada de uma
  // cena dividida (a outra parte pode já estar num dia).
  const boneyard: StripItem[] = scenes
    .sort((a, b) => naturalCompare(a.numero, b.numero))
    .flatMap((scene) => {
      if (scene.parts.length === 0) return scene.shootDays.length === 0 ? [toStripItem(scene, null)] : [];
      return scene.parts.filter((p) => !p.sceneShootDay).map((p) => toStripItem(scene, p));
    });

  const days: DayState[] = shootDays.map((day) => {
    const sceneItems: StripItem[] = day.scenes.map((entry) => ({
      ...toStripItem(entry.scene, entry.scene.parts.find((p) => p.id === entry.scenePartId) ?? null),
      prepMin: entry.prepMin,
      rodMin: entry.rodMin,
      observacoes: entry.observacoes,
      observacoesAutoGeradas: entry.observacoesAutoGeradas,
    }));

    // Bloco não existe mais como duas listas: manhã/tarde são derivadas da posição do marcador de
    // almoço (almocoIndex) dentro da lista única `scenes`, já ordenada por SceneShootDay.ordem.
    // Enquanto a diária nunca foi dividida manualmente (todas as cenas ainda em bloco MANHA — o
    // mesmo critério usado por recalculateDayBlocks pra decidir se ainda pode auto-posicionar),
    // sugere aqui a mesma posição que seria persistida no próximo recálculo, pra já exibir a posição
    // certa do marcador antes mesmo de qualquer gravação.
    const neverSplit = day.scenes.length > 0 && day.scenes.every((e) => e.bloco === "MANHA");
    const almocoIndex = neverSplit
      ? suggestAlmocoIndex(
          day.chamadaGeral,
          day.blocoManhaInicio,
          day.scenes.map((e) => ({
            prepMin: resolveEffectivePrepMin(e.prepMin),
            rodMin: resolveEffectiveRodMin(
              e.rodMin,
              tempoEstimadoDaEntrada(
                e.scene.tempoEstimadoMin,
                paginasParaOitavos(e.scene.paginas),
                e.scene.parts.find((p) => p.id === e.scenePartId)
              )
            ),
          })),
          project.limiteAlmocoMin
        )
      : day.scenes.filter((e) => e.bloco === "MANHA").length;

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
      fatorResetPercent: day.fatorResetPercent,
      scenes: sceneItems,
      almocoIndex,
    };
  });

  const board: BoardState = { boneyard, days };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stripboard"
        help={{
          title: "Stripboard",
          description:
            "O Stripboard organiza as cenas em dias de filmagem. Cada tira colorida representa uma cena — azul para dia, roxo para entardecer, cinza para noite. Arraste para reordenar. As cenas não agendadas ficam no Boneyard.",
        }}
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
          jornada={{ limiteAlmocoMin: project.limiteAlmocoMin, duracaoAlmocoMin: project.duracaoAlmocoMin }}
        />
      )}

      {(() => {
        const primeiraSemOD = shootDays.find((d) => !d.locacaoNome || !d.chamadaGeral);
        if (!primeiraSemOD) return null;
        return (
          <NextStepFooter>
            <Link
              href={`/projects/${params.id}/shootdays/${primeiraSemOD.id}/ordem-do-dia`}
              className="hover:text-foreground hover:underline"
            >
              Montar a Ordem do Dia da Diária {primeiraSemOD.numeroDia} →
            </Link>
          </NextStepFooter>
        );
      })()}
    </div>
  );
}
