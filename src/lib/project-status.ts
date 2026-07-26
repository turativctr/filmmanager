import type { ProjectStatus } from "@prisma/client";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ATIVO: "Ativo",
  CONCLUIDO: "Concluído",
};

// O schema hoje só tem 2 fases (ATIVO/CONCLUÍDO) + arquivado, não as 6 fases de produção
// (Desenvolvimento/Pré-produção/Filmagem/Pós-produção/Concluído/Arquivado) do mapa de cores do
// design system — CONCLUIDO usa "sucesso" (verde), arquivado usa "neutro" (cinza). Os módulos
// drafts/scheduling/alerta/decupagem ficam disponíveis em tailwind.config.ts pra quando as fases
// intermediárias existirem como dado de verdade.
export const PROJECT_STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  ATIVO: "border-scheduling-accent/30 bg-scheduling-bg text-scheduling-fg",
  CONCLUIDO: "border-sucesso-accent/30 bg-sucesso-bg text-sucesso-fg",
};

export const PROJECT_ARQUIVADO_BADGE_CLASS = "border-neutro-accent/30 bg-neutro-bg text-neutro-fg";
