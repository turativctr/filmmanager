import { CheckCircle2, Circle, PauseCircle, PlayCircle } from "lucide-react";

import type { SceneShootDayStatusValue } from "@/lib/scene-progress";
import { cn } from "@/lib/utils";

// Noir tem saturação baixíssima de propósito (lê como escala de cinza) — por isso, só nesse
// tema, todo indicador de status ganha um ícone além da cor (ver .theme-status-icon em
// globals.css: visibilidade decidida em CSS puro, não em JS, pra não depender do tema já
// resolvido no momento da hidratação).
const SCENE_STATUS_ICON: Record<SceneShootDayStatusValue, typeof Circle> = {
  PENDENTE: Circle,
  EM_ANDAMENTO: PlayCircle,
  CONCLUIDA: CheckCircle2,
  ADIADA: PauseCircle,
};

export function SceneStatusIcon({
  status,
  className,
}: {
  status: SceneShootDayStatusValue;
  className?: string;
}) {
  const Icon = SCENE_STATUS_ICON[status];
  return <Icon className={cn("theme-status-icon h-3.5 w-3.5 shrink-0", className)} aria-hidden />;
}
