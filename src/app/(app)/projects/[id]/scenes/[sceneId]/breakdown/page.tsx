import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BreakdownForm } from "@/components/breakdown/breakdown-form";
import { SinopseADField } from "@/components/breakdown/sinopse-ad-field";
import { ShotListPanel } from "@/components/breakdown/shot-list-panel";
import { ContinuityNotesPanel } from "@/components/ad-documents/continuity-notes-panel";
import { InfoBanner } from "@/components/shared/info-banner";
import { NextStepFooter } from "@/components/shared/next-step-footer";
import { Button } from "@/components/ui/button";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";

const PERIODO_LABEL: Record<string, string> = {
  DIA: "Dia",
  NOITE: "Noite",
  ENTARDECER: "Entardecer",
  AMANHECER: "Amanhecer",
  CONTINUO: "Contínuo",
  DEPOIS: "Depois",
};

export default async function BreakdownPage({
  params,
}: {
  params: { id: string; sceneId: string };
}) {
  const scene = await prisma.scene.findFirst({
    where: { id: params.sceneId, projectId: params.id },
    include: { cast: true, breakdownSheet: true, extras: true, locacao: { select: { nome: true } } },
  });

  if (!scene) notFound();

  const [project, allCharacters, allExtras, shootDays, continuityNotes, shots, semBreakdown] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.id }, select: { sistemaIdElenco: true } }),
    prisma.character.findMany({
      where: { projectId: params.id },
      orderBy: { idCurto: "asc" },
      select: { id: true, idCurto: true, numeroElenco: true, personagem: true },
    }),
    prisma.extra.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, personagem: true, quantidade: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId: params.id },
      orderBy: { numeroDia: "asc" },
      select: { id: true, numeroDia: true },
    }),
    prisma.continuityNote.findMany({
      where: { sceneId: scene.id },
      include: { shootDay: { select: { numeroDia: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shot.findMany({ where: { sceneId: scene.id }, orderBy: { ordem: "asc" } }),
    prisma.scene.findMany({
      where: { projectId: params.id, omitida: false, breakdownSheet: { is: null }, id: { not: scene.id } },
      select: { id: true, numero: true },
    }),
  ]);

  const proximaSemBreakdown = [...semBreakdown].sort((a, b) => naturalCompare(a.numero, b.numero))[0];

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={`/projects/${params.id}/scenes`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para cenas
          </Link>
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">
          Breakdown — Cena {scene.numero}
        </h2>
        <p className="text-sm text-muted-foreground">
          {scene.tipo ?? "—"} · {scene.periodo ? PERIODO_LABEL[scene.periodo] ?? scene.periodo : "—"}
          {scene.set ? ` · ${scene.set}` : ""}
          {scene.locacao ? ` · ${scene.locacao.nome}` : ""}
        </p>
      </div>

      <InfoBanner
        storageKey="breakdown"
        title="Breakdown"
        description="O Breakdown detalha tudo que cada cena precisa: elenco, figurino, props, maquiagem, som e notas por departamento. Esses dados aparecem na Análise Técnica e alimentam os alertas automáticos da Ordem do Dia."
      />

      <SinopseADField
        projectId={params.id}
        sceneId={scene.id}
        sinopseAD={scene.sinopseAD}
        sinopse={scene.sinopse}
      />

      <BreakdownForm
        projectId={params.id}
        sceneId={scene.id}
        sistemaIdElenco={project.sistemaIdElenco}
        initialTempoEstimadoMin={scene.tempoEstimadoMin}
        allCharacters={allCharacters}
        initialCastIds={scene.cast.map((c) => c.characterId)}
        allExtras={allExtras}
        initialLinkedExtraIds={scene.extras.map((e) => e.extraId)}
        initialBreakdown={
          scene.breakdownSheet
            ? {
                figurino: scene.breakdownSheet.figurino,
                make: scene.breakdownSheet.make,
                arteDressing: scene.breakdownSheet.arteDressing ?? "",
                objetos: scene.breakdownSheet.objetos,
                comidaCena: scene.breakdownSheet.comidaCena,
                microfones: scene.breakdownSheet.microfones,
                trilha: scene.breakdownSheet.trilha,
                habilidades: scene.breakdownSheet.habilidades,
                arteGrafica: scene.breakdownSheet.arteGrafica,
                posProducao: scene.breakdownSheet.posProducao,
                notasArte: scene.breakdownSheet.notasArte ?? "",
                notasFoto: scene.breakdownSheet.notasFoto ?? "",
                notasSom: scene.breakdownSheet.notasSom ?? "",
                notasContinuidade: scene.breakdownSheet.notasContinuidade ?? "",
                notasProducao: scene.breakdownSheet.notasProducao ?? "",
              }
            : null
        }
      />

      <ContinuityNotesPanel
        projectId={params.id}
        sceneId={scene.id}
        shootDays={shootDays}
        initialNotes={continuityNotes}
      />

      <ShotListPanel projectId={params.id} sceneId={scene.id} initialShots={shots} />

      {proximaSemBreakdown && (
        <NextStepFooter>
          <Link
            href={`/projects/${params.id}/scenes/${proximaSemBreakdown.id}/breakdown`}
            className="hover:text-foreground hover:underline"
          >
            Próxima cena sem breakdown: cena {proximaSemBreakdown.numero} →
          </Link>
        </NextStepFooter>
      )}
    </div>
  );
}
