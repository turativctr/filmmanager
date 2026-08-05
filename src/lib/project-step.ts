import type { ProjectStepEtapa } from "@prisma/client";
import { CalendarRange, DollarSign, FileClock, FileText, ListChecks, Users } from "lucide-react";

import type { ProgressStep, ProgressStepStatus } from "@/components/projects/guided-progress-panel";

import { prisma } from "./prisma";

export const PROJECT_STEP_ETAPAS: ProjectStepEtapa[] = [
  "ROTEIRO",
  "ELENCO",
  "BREAKDOWN",
  "CRONOGRAMA",
  "ORDEM_DO_DIA",
  "ORCAMENTO",
];

export function isProjectStepEtapa(value: string): value is ProjectStepEtapa {
  return (PROJECT_STEP_ETAPAS as string[]).includes(value);
}

/** Os 6 passos guiados (título/descrição/status/href), com o status automático já resolvido
 *  contra override manual — extraído da antiga Visão Geral pra ser reaproveitado por ela mesma
 *  (bloco "Comece por aqui" do Estado A), pela nova rota /guia, e pelo badge da sidebar
 *  (/api/projects/[id]/guide-status). Critérios automáticos inalterados. */
export async function computeProjectSteps(projectId: string): Promise<ProgressStep[]> {
  const [
    scriptDraftsCount,
    charactersWithAtorCount,
    totalScenesCount,
    scenesWithBreakdownCount,
    shootDaysWithScenesCount,
    shootDaysWithLogisticsCount,
    projectWithBudget,
    stepOverrides,
  ] = await Promise.all([
    prisma.scriptDraft.count({ where: { projectId } }),
    prisma.character.count({ where: { projectId, ator: { not: null } } }),
    prisma.scene.count({ where: { projectId } }),
    prisma.scene.count({ where: { projectId, breakdownSheet: { isNot: null } } }),
    prisma.shootDay.count({ where: { projectId, scenes: { some: {} } } }),
    prisma.shootDay.count({
      where: { projectId, locacaoNome: { not: null }, chamadaGeral: { not: null } },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { budget: { select: { _count: { select: { lineItems: true } } } } },
    }),
    prisma.projectStepOverride.findMany({ where: { projectId } }),
  ]);

  function breakdownStatus(): ProgressStepStatus {
    if (totalScenesCount === 0 || scenesWithBreakdownCount === 0) return "pendente";
    if (scenesWithBreakdownCount === totalScenesCount) return "completo";
    return "parcial";
  }

  const hasBudgetLineItem = (projectWithBudget?.budget?._count.lineItems ?? 0) > 0;

  const overrideMap = new Map(stepOverrides.map((o) => [o.etapa, o]));

  // Status final = automático OU marcado manualmente. Se o automático já virou "completo" por
  // conta própria, ele prevalece na exibição — o override fica dormente (não é apagado, só
  // ignorado aqui).
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

  return [
    {
      key: "roteiro",
      etapa: "ROTEIRO",
      icon: FileText,
      title: "Importe seu roteiro",
      description: "Faça upload do .fdx ou .wdz para detectar cenas, personagens e oitavas automaticamente.",
      status: roteiro.status,
      isManual: roteiro.isManual,
      actionLabel: scriptDraftsCount > 0 ? "Ver roteiro importado" : "Importar roteiro",
      href: `/projects/${projectId}/scenes`,
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
      href: `/projects/${projectId}/cast`,
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
      href: `/projects/${projectId}/scenes`,
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
      href: `/projects/${projectId}/stripboard`,
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
      href: `/projects/${projectId}/calendar`,
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
      href: `/projects/${projectId}/budget/topsheet`,
    },
  ];
}
