import { Clapperboard } from "lucide-react";
import Link from "next/link";

import { FdxImportDialog } from "@/components/scenes/fdx-import-dialog";
import { ScenesTable } from "@/components/scenes/scenes-table";
import { SceneFormDialog } from "@/components/scenes/scene-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { NextStepFooter } from "@/components/shared/next-step-footer";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { compareLocacaoNome } from "@/lib/locacao";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";

export default async function ScenesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { semLocacao?: string };
}) {
  const semLocacaoAtivo = searchParams.semLocacao === "1";

  const [project, scenes, characters, locacoes, naoAgendadasCount, semLocacaoCount] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.id }, select: { sistemaIdElenco: true } }),
    prisma.scene.findMany({
      where: { projectId: params.id, ...(semLocacaoAtivo ? { locacaoId: null } : {}) },
      include: { cast: { select: { characterId: true } }, locacao: { select: { id: true, nome: true } } },
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
    prisma.scene.count({ where: { projectId: params.id, omitida: false, shootDays: { none: {} } } }),
    prisma.scene.count({ where: { projectId: params.id, omitida: false, locacaoId: null } }),
  ]);

  locacoes.sort((a, b) => compareLocacaoNome(a.nome, b.nome));

  const sortedScenes = [...scenes]
    .sort((a, b) => naturalCompare(a.numero, b.numero))
    .map((scene) => ({ ...scene, paginas: scene.paginas.toString() }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cenas"
        help={{
          title: "Cenas",
          description:
            "As cenas são a base de todo o projeto. Cada cena contém as informações que alimentam o Breakdown, o Stripboard e os documentos gerados. Importe do roteiro (.fdx) ou cadastre manualmente.",
        }}
        actions={
          <>
            <FdxImportDialog projectId={params.id} />
            <SceneFormDialog
              projectId={params.id}
              characters={characters}
              sistemaIdElenco={project.sistemaIdElenco}
              locacoes={locacoes}
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
              : "Importe o roteiro (.fdx) para detectar cenas automaticamente, ou cadastre manualmente."
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
