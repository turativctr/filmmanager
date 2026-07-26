import type { ProjectStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { PROJECT_ARQUIVADO_BADGE_CLASS, PROJECT_STATUS_BADGE_CLASS, PROJECT_STATUS_LABEL } from "@/lib/project-status";
import { cn } from "@/lib/utils";

export function ProjectStatusBadges({
  status,
  arquivado,
  className,
}: {
  status: ProjectStatus;
  arquivado: boolean;
  className?: string;
}) {
  if (status === "ATIVO" && !arquivado) return null;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {status !== "ATIVO" && (
        <Badge variant="outline" className={PROJECT_STATUS_BADGE_CLASS[status]}>
          {PROJECT_STATUS_LABEL[status]}
        </Badge>
      )}
      {arquivado && (
        <Badge variant="outline" className={PROJECT_ARQUIVADO_BADGE_CLASS}>
          Arquivado
        </Badge>
      )}
    </span>
  );
}
