import { Clapperboard } from "lucide-react";
import Link from "next/link";

import { FdxImportDialog } from "@/components/scenes/fdx-import-dialog";
import { MasterMulticenaDialog } from "@/components/scenes/master-multicena-dialog";
import { ScenesTable } from "@/components/scenes/scenes-table";
import { SceneFormDialog } from "@/components/scenes/scene-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { NextStepFooter } from "@/components/shared/next-step-footer";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { compareLocacaoNome } from "@/lib/locacao";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";
import { computeSceneShotTotals } from "@/lib/shots-shared";

export default async function ScenesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { semLocacao?: string };
}) {
  const semLocacaoAtivo = searchParams.semLocacao === "1";

  const [project, scenes, characters, locacoes, naoAgendadasCount, semLocacaoCount] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { sistemaIdElenco: true, minPorOitavoPartida: true, acrescimoExteriorPercent: true },
    }),
    prisma.scene.findMany({
      where: { projectId: params.id, ...(semLocacaoAtivo ? { locacaoId: null } : {}) },
      include: {
        cast: { select: { characterId: true } },
        locacao: { select: { id: true, nome: true } },
        cobre: { select: { scene: { select: { id: true, numero: true } } } },
        shots: {
          select: { tempoTotalMin: true, tempoResetMin: true, tempoResetMinManual: true, takesPrevistos: true, status: true },
        },
      },
    }),
    prisma.character.findMany({
      where: { projectId: params.id },
      orderBy: { idCurto: "asc" },
      select: { id: true, idCurto: true, numeroElenco: true, personagem: true },
    }),
    prisma.locacao.findMany({
      where: { projectId: params.id },
      select: { id: true, nome: true },
    }),
    // Sem diária: cena inteira fora de diária, ou dividida com alguma parte ainda fora.
    prisma.scene.count({
      where: {
        projectId: params.id,
        omitida: false,
        OR: [
          { parts: { none: {} }, shootDays: { none: {} } },
          { parts: { some: { sceneShootDay: { is: null } } } },
        ],
      },
    }),
    prisma.scene.count({ where: { projectId: params.id, omitida: false, locacaoId: null } }),
  ]);

  locacoes.sort((a, b) => compareLocacaoNome(a.nome, b.nome));

  const partida = {
    minPorOitavo: project.minPorOitavoPartida,
    acrescimoExteriorPercent: project.acrescimoExteriorPercent,
  };

  const sortedScenes = [...scenes]
    .sort((a, b) => naturalCompare(a.numero, b.numero))
    .map(({ cobre, shots, ...scene }) => ({
      ...scene,
      paginas: scene.paginas.toString(),
      somaPlanosMin: shots.length > 0 ? computeSceneShotTotals(shots).totalMin : null,
      cobre: cobre.map((c) => c.scene).sort((a, b) => naturalCompare(a.numero, b.numero)),
    }));

  // Cenas que um master pode cobrir: as do roteiro, ativas. Vem da lista completa — o filtro "sem
  // locação" da página não deve esconder cenas do diálogo.
  const cenasCobriveis = (
    semLocacaoAtivo
      ? await prisma.scene.findMany({
          where: { projectId: params.id, origem: "ROTEIRO", omitida: false },
          include: { locacao: { select: { nome: true } } },
        })
      : scenes.filter((s) => s.origem === "ROTEIRO" && !s.omitida)
  )
    .sort((a, b) => naturalCompare(a.numero, b.numero))
    .map((s) => ({ id: s.id, numero: s.numero, set: s.set, locacao: s.locacao?.nome ?? null }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cenas"
        help={{
          title: "Cenas",
          description:
            "As cenas são a base de todo o projeto. Cada cena contém as informações que alimentam o Breakdown, o Stripboard e os documentos gerados. Importe do roteiro (.fdx ou .pdf) ou cadastre manualmente.",
        }}
        actions={
          <>
            <FdxImportDialog projectId={params.id} />
            <MasterMulticenaDialog projectId={params.id} cenas={cenasCobriveis} />
            <SceneFormDialog
              projectId={params.id}
              characters={characters}
              sistemaIdElenco={project.sistemaIdElenco}
              locacoes={locacoes}
              partida={partida}
            />
          </>
        }
      />

      {sortedScenes.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title={semLocacaoAtivo ? "Nenhuma cena sem locação" : "Nenhuma cena cadastrada ainda"}
          description={
            semLocacaoAtivo
              ? "Todas as cenas já têm locação definida."
              : "Importe o roteiro (.fdx ou .pdf) para detectar cenas automaticamente, ou cadastre manualmente."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScenesTable
              projectId={params.id}
              scenes={sortedScenes}
              characters={characters}
              sistemaIdElenco={project.sistemaIdElenco}
              locacoes={locacoes}
              partida={partida}
              cenasCobriveis={cenasCobriveis}
            />
          </CardContent>
        </Card>
      )}

      {(naoAgendadasCount > 0 || semLocacaoCount > 0) && (
        <NextStepFooter>
          {naoAgendadasCount > 0 && (
            <Link href={`/projects/${params.id}/stripboard`} className="hover:text-foreground hover:underline">
              {naoAgendadasCount} {naoAgendadasCount === 1 ? "cena ainda não agendada" : "cenas ainda não agendadas"} →
              Stripboard
            </Link>
          )}
          {semLocacaoCount > 0 && (
            <Link
              href={`/projects/${params.id}/scenes${semLocacaoAtivo ? "" : "?semLocacao=1"}`}
              className="hover:text-foreground hover:underline"
            >
              {semLocacaoAtivo
                ? "Mostrar todas as cenas"
                : `${semLocacaoCount} ${semLocacaoCount === 1 ? "cena sem locação definida" : "cenas sem locação definida"}`}
            </Link>
          )}
        </NextStepFooter>
      )}
    </div>
  );
}
