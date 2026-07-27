import type { ProjectStepEtapa } from "@prisma/client";
import { CalendarRange, DollarSign, FileClock, FileText, ListChecks, Users } from "lucide-react";
import { getServerSession } from "next-auth";

import { GuidedProgressPanel, type ProgressStep, type ProgressStepStatus } from "@/components/projects/guided-progress-panel";
import { ProjectStatusBadges } from "@/components/projects/project-status-badge";
import { WelcomeTourModal } from "@/components/tour/welcome-tour-modal";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectOverviewPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  const [
    project,
    scriptDraftsCount,
    charactersWithAtorCount,
    totalScenesCount,
    scenesWithBreakdownCount,
    shootDaysWithScenesCount,
    shootDaysWithLogisticsCount,
    projectWithBudget,
    currentUser,
    stepOverrides,
  ] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { titulo: true, diretor: true, producao: true, status: true, arquivado: true },
    }),
    prisma.scriptDraft.count({ where: { projectId: params.id } }),
    prisma.character.count({ where: { projectId: params.id, ator: { not: null } } }),
    prisma.scene.count({ where: { projectId: params.id } }),
    prisma.scene.count({ where: { projectId: params.id, breakdownSheet: { isNot: null } } }),
    prisma.shootDay.count({ where: { projectId: params.id, scenes: { some: {} } } }),
    prisma.shootDay.count({
      where: { projectId: params.id, locacaoNome: { not: null }, chamadaGeral: { not: null } },
    }),
    prisma.project.findUnique({
      where: { id: params.id },
      select: { budget: { select: { _count: { select: { lineItems: true } } } } },
    }),
    session ? prisma.user.findUnique({ where: { id: session.user.id }, select: { tourConcluido: true } }) : null,
    prisma.projectStepOverride.findMany({ where: { projectId: params.id } }),
  ]);

  function breakdownStatus(): ProgressStepStatus {
    if (totalScenesCount === 0 || scenesWithBreakdownCount === 0) return "pendente";
    if (scenesWithBreakdownCount === totalScenesCount) return "completo";
    return "parcial";
  }

  const hasBudgetLineItem = (projectWithBudget?.budget?._count.lineItems ?? 0) > 0;

  const overrideMap = new Map(stepOverrides.map((o) => [o.etapa, o]));

  // Status final = automático OU marcado manualmente. Se o automático já virou "completo" por conta
  // própria, ele prevalece na exibição — o override fica dormente (não é apagado, só ignorado aqui).
  function resolveStatus(
    etapa: ProjectStepEtapa,
    autoStatus: ProgressStepStatus
  ): { status: ProgressStepStatus; isManual: boolean } {
    if (autoStatus === "completo") return { status: "completo", isManual: false };
    if (overrideMap.get(etapa)?.concluidaManualmente) return { status: "completo", isManual: true };
    return { status: autoStatus, isManual: false };
  }

  const roteiro = resolveStatus("ROTEIRO", scriptDraftsCount > 0 ? "completo" : "pendente");
  const elenco = resolveStatus("ELENCO", charactersWithAtorCount > 0 ? "completo" : "pendente");
  const breakdown = resolveStatus("BREAKDOWN", breakdownStatus());
  const cronograma = resolveStatus("CRONOGRAMA", shootDaysWithScenesCount > 0 ? "completo" : "pendente");
  const ordemDoDia = resolveStatus("ORDEM_DO_DIA", shootDaysWithLogisticsCount > 0 ? "completo" : "pendente");
  const orcamento = resolveStatus("ORCAMENTO", hasBudgetLineItem ? "completo" : "pendente");

  const steps: ProgressStep[] = [
    {
      key: "roteiro",
      etapa: "ROTEIRO",
      icon: FileText,
      title: "Importe seu roteiro",
      description: "Faça upload do .fdx ou .wdz para detectar cenas, personagens e oitavas automaticamente.",
      status: roteiro.status,
      isManual: roteiro.isManual,
      actionLabel: scriptDraftsCount > 0 ? "Ver roteiro importado" : "Importar roteiro",
      href: `/projects/${params.id}/scenes`,
    },
    {
      key: "elenco",
      etapa: "ELENCO",
      icon: Users,
      title: "Confirme o elenco",
      description:
        "Revise os personagens detectados, vincule os atores, defina categorias (Principal, Coadjuvante...) e ajuste os IDs.",
      status: elenco.status,
      isManual: elenco.isManual,
      actionLabel: "Gerenciar elenco",
      href: `/projects/${params.id}/cast`,
    },
    {
      key: "breakdown",
      etapa: "BREAKDOWN",
      icon: ListChecks,
      title: "Preencha os breakdowns",
      description:
        "Para cada cena, registre figurino, props, maquiagem, som e notas por departamento. Esses dados alimentam a Análise Técnica.",
      status: breakdown.status,
      isManual: breakdown.isManual,
      actionLabel: "Ir para cenas",
      href: `/projects/${params.id}/scenes`,
    },
    {
      key: "cronograma",
      etapa: "CRONOGRAMA",
      icon: CalendarRange,
      title: "Monte o cronograma",
      description: "Organize as cenas em dias de filmagem no Stripboard. Arraste as tiras para definir a ordem e os blocos do dia.",
      status: cronograma.status,
      isManual: cronograma.isManual,
      actionLabel: "Abrir Stripboard",
      href: `/projects/${params.id}/stripboard`,
    },
    {
      key: "ordem-do-dia",
      etapa: "ORDEM_DO_DIA",
      icon: FileClock,
      title: "Gere as ordens do dia",
      description:
        "Com o cronograma montado, o sistema gera automaticamente a Call Sheet, o Plano HH e a Análise Técnica de cada diária.",
      status: ordemDoDia.status,
      isManual: ordemDoDia.isManual,
      actionLabel: "Ver diárias",
      href: `/projects/${params.id}/calendar`,
    },
    {
      key: "orcamento",
      etapa: "ORCAMENTO",
      icon: DollarSign,
      title: "Monte o orçamento",
      description: "Registre os custos por departamento, configure encargos e globais, e acompanhe o realizado vs. planejado.",
      status: orcamento.status,
      isManual: orcamento.isManual,
      actionLabel: "Abrir orçamento",
      href: `/projects/${params.id}/budget/topsheet`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Única página do projeto que mostra nome/créditos/status — em toda outra página essa
          informação já vive no breadcrumb do Header global, ver PageHeader. */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{project.titulo}</h1>
          <ProjectStatusBadges status={project.status} arquivado={project.arquivado} />
        </div>
        <p className="text-sm text-muted-foreground">
          {[project.diretor && `Direção: ${project.diretor}`, project.producao].filter(Boolean).join(" · ")}
        </p>
      </div>

      <GuidedProgressPanel projectId={params.id} steps={steps} />
      {currentUser && !currentUser.tourConcluido && <WelcomeTourModal projectId={params.id} />}
    </div>
  );
}
