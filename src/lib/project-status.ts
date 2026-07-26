import type { ProjectStatus } from "@prisma/client";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ATIVO: "Ativo",
  CONCLUIDO: "Concluído",
};

export const PROJECT_STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  ATIVO: "border-blue-400/50 bg-blue-100 text-blue-700",
  CONCLUIDO: "border-green-400/50 bg-green-100 text-green-700",
};

export const PROJECT_ARQUIVADO_BADGE_CLASS = "border-gray-300/50 bg-gray-100 text-gray-500";
