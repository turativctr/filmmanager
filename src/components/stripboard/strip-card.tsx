"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ChevronDown, ChevronRight, FileText, GripVertical } from "lucide-react";
import { useEffect, useState } from "react";

import { ScenePlanosPanel } from "@/components/stripboard/scene-planos-panel";
import { ShotListDrawer } from "@/components/stripboard/shot-list-drawer";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPaginas } from "@/lib/paginas";
import { formatHHh } from "@/lib/schedule";
import { cn } from "@/lib/utils";

import type { ComputedSchedule } from "@/lib/schedule";
import type { StripItem } from "./types";

/** Cor de destaque (borda esquerda) por período — a tira é sólida (bg-surface) desde a redução de
 *  largura; o período deixou de tingir o card inteiro e virou só essa faixa de 3px. */
const PERIODO_BORDER: Record<string, string> = {
  DIA: "#2563EB",
  NOITE: "#B45309",
  ENTARDECER: "#7C3AED",
  AMANHECER: "#EA580C",
  CONTINUO: "#64748B",
  DEPOIS: "#64748B",
};

// Cenas que atravessam de um período pro outro (NOITE_PARA_DIA/DIA_PARA_NOITE) ganham uma
// faixa em degradê entre as duas cores em vez de uma única — sinaliza visualmente que a
// filmagem precisa de dois momentos de luz distintos, sem inventar uma terceira cor "neutra".
const PERIODO_BORDER_GRADIENT: Record<string, string> = {
  NOITE_PARA_DIA: `linear-gradient(to bottom, ${PERIODO_BORDER.NOITE}, ${PERIODO_BORDER.DIA})`,
  DIA_PARA_NOITE: `linear-gradient(to bottom, ${PERIODO_BORDER.DIA}, ${PERIODO_BORDER.NOITE})`,
};

const MAX_CAST_BADGES = 4;

export function StripCard({
  item,
  characterLabels,
  schedule,
  conflicts,
  neutral,
  onUpdateTimes,
  projectId,
  shootDayId,
  fatorResetPercent,
}: {
  item: StripItem;
  characterLabels: string[];
  schedule?: ComputedSchedule | null;
  conflicts?: string[];
  neutral?: boolean;
  onUpdateTimes?: (prepMin: number | null, rodMin: number | null) => void;
  projectId?: string;
  shootDayId?: string;
  /** Ritmo dos resets da diária (nível 3) — ausente no Boneyard/preview de drag. */
  fatorResetPercent?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.sceneId,
  });
  const [prepDraft, setPrepDraft] = useState(item.prepMin?.toString() ?? "");
  const [rodDraft, setRodDraft] = useState(item.rodMin?.toString() ?? "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Ressincroniza os drafts quando o item muda por fora (ex.: revert otimista após falha ao salvar) —
  // sem isso o input local fica preso no valor digitado mesmo depois do board voltar ao estado anterior.
  useEffect(() => {
    setPrepDraft(item.prepMin?.toString() ?? "");
    setRodDraft(item.rodMin?.toString() ?? "");
  }, [item.prepMin, item.rodMin]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasConflict = Boolean(conflicts?.length);
  const isOmitida = item.scene.omitida;
  const hasShots = Boolean(item.shotsSummary && item.shotsSummary.count > 0);
  // Card fantasma do DragOverlay não recebe onUpdateTimes — evita mostrar avisos nele.
  const showTempoBadge = !neutral && Boolean(onUpdateTimes) && (item.prepMin ?? 0) === 0 && (item.rodMin ?? 0) === 0;
  // Sinaliza quando o Rod desta diária diverge da soma dos planos — normalmente ficam sincronizados
  // automaticamente (recalculateScene), então isso só acontece se alguém editou o Rod manualmente.
  const showTempoManualBadge =
    !neutral && Boolean(onUpdateTimes) && hasShots && item.rodMin !== item.shotsSummary!.totalMin;

  function commitTimes() {
    const prep = prepDraft === "" ? null : Number(prepDraft);
    const rod = rodDraft === "" ? null : Number(rodDraft);
    onUpdateTimes?.(prep, rod);
  }

  const canExpand = Boolean(projectId);
  const periodo = item.scene.periodo;
  const borderGradient = !neutral && periodo ? PERIODO_BORDER_GRADIENT[periodo] : undefined;
  const borderColor = !neutral && periodo && !borderGradient ? PERIODO_BORDER[periodo] : undefined;

  const visibleCast = characterLabels.slice(0, MAX_CAST_BADGES);
  const overflowCast = characterLabels.length - visibleCast.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("rounded-md border bg-surface text-sm shadow-sm", (hasConflict || isOmitida) && "border-destructive")}
    >
      <div
        className={cn("flex h-11 items-center gap-2 border-l-[3px] pr-3", canExpand && "cursor-pointer")}
        style={
          borderGradient
            ? { borderImage: `${borderGradient} 1` }
            : { borderLeftColor: borderColor ?? "transparent" }
        }
        onClick={() => {
          if (canExpand) setExpanded((e) => !e);
        }}
      >
        {canExpand &&
          (expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          ))}
        <button
          type="button"
          className="shrink-0 touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <span className="w-7 shrink-0 text-center font-bold">{item.scene.numero}</span>

        {(isOmitida || hasConflict) && (
          <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isOmitida && (
              <Tooltip>
                <TooltipTrigger className="rounded border border-destructive/40 bg-destructive/10 px-1 py-0.5 text-[9px] font-semibold text-destructive">
                  OMIT
                </TooltipTrigger>
                <TooltipContent>
                  Esta cena foi removida (OMITIDA) numa revisão mais recente do roteiro, mas ainda está
                  agendada aqui.
                </TooltipContent>
              </Tooltip>
            )}
            {hasConflict && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                </TooltipTrigger>
                <TooltipContent>{conflicts!.join("\n")}</TooltipContent>
              </Tooltip>
            )}
          </span>
        )}

        <span className="w-24 shrink-0 truncate text-xs font-medium text-muted-foreground">
          {item.scene.tipo ?? "—"}·{item.scene.periodo ?? "—"}
        </span>

        <span className="min-w-0 flex-1 truncate" title={item.scene.set ?? item.scene.locacao ?? undefined}>
          {item.scene.set ?? item.scene.locacao ?? "—"}
        </span>

        <span className="flex w-32 shrink-0 items-center gap-1 overflow-hidden">
          {visibleCast.map((label) => (
            <Badge key={label} variant="secondary" className="shrink-0 text-[10px]">
              {label}
            </Badge>
          ))}
          {overflowCast > 0 && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              +{overflowCast}
            </Badge>
          )}
        </span>

        <span className="w-10 shrink-0 text-right text-xs">{formatPaginas(item.scene.paginas)}</span>

        <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
          {schedule ? formatHHh(schedule.rodStart) : "—"}
        </span>

        {showTempoManualBadge && (
          <span onClick={(e) => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger className="block h-2 w-2 shrink-0 rounded-full bg-alerta-accent" />
              <TooltipContent>Tempo manual difere dos planos</TooltipContent>
            </Tooltip>
          </span>
        )}
      </div>

      {expanded && canExpand && (
        <div className="space-y-2.5 border-t px-3 py-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
          {item.scene.sinopse && <p className="text-muted-foreground">{item.scene.sinopse}</p>}

          <div className="flex flex-wrap items-center gap-3">
            {onUpdateTimes && (
              <span className="flex items-center gap-1">
                <label className="text-muted-foreground">Prep</label>
                <input
                  type="number"
                  className="w-14 rounded border bg-background px-1 py-0.5"
                  value={prepDraft}
                  onChange={(e) => setPrepDraft(e.target.value)}
                  onBlur={commitTimes}
                />
                <label className="text-muted-foreground">Rod</label>
                <input
                  type="number"
                  className="w-14 rounded border bg-background px-1 py-0.5"
                  value={rodDraft}
                  onChange={(e) => setRodDraft(e.target.value)}
                  onBlur={commitTimes}
                />
              </span>
            )}
            {schedule && (
              <span className="text-muted-foreground">
                Prep: {formatHHh(schedule.prepStart)} às {formatHHh(schedule.prepEnd)} · Rod:{" "}
                {formatHHh(schedule.rodStart)} às {formatHHh(schedule.rodEnd)}
              </span>
            )}
          </div>

          {showTempoBadge && (
            <p className="font-semibold text-alerta-fg">
              ! Tempo não definido — Prep e Rod não foram definidos para esta cena; o horário exibido usa
              valores padrão.
            </p>
          )}

          {showTempoManualBadge && (
            <p className="flex flex-wrap items-center gap-2 font-semibold text-alerta-fg">
              Tempo manual — planos somam {item.shotsSummary!.totalMin}min
              <button
                type="button"
                className="rounded border border-alerta-accent/60 bg-alerta-bg px-1.5 py-0.5 font-semibold hover:bg-alerta-bg/70"
                onClick={() => onUpdateTimes?.(item.prepMin, item.shotsSummary!.totalMin)}
              >
                Usar tempo dos planos
              </button>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            {hasShots && projectId ? (
              <button
                type="button"
                className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                onClick={() => setDrawerOpen(true)}
              >
                {item.shotsSummary!.count} planos · {item.shotsSummary!.takesTotal} takes
              </button>
            ) : null}
            <span>
              {hasShots
                ? `${item.shotsSummary!.totalMin} min estimados`
                : item.scene.tempoEstimadoMin != null
                  ? `${item.scene.tempoEstimadoMin} min estimados`
                  : "Tempo estimado não definido"}
            </span>
            {item.scene.diaNarrativo != null && <Badge variant="outline">Dia {item.scene.diaNarrativo}</Badge>}
            {item.scene.notasAD && (
              <span className="flex items-center gap-1 text-amber-700">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {item.scene.notasAD}
              </span>
            )}
          </div>

          {projectId && (
            <ScenePlanosPanel
              projectId={projectId}
              sceneId={item.sceneId}
              shootDayId={shootDayId}
              periodoColor={
                item.scene.periodo
                  ? PERIODO_BORDER[item.scene.periodo] ??
                    // Painel de planos usa uma faixa sólida (sem degradê) — cenas em transição
                    // mostram a cor do período de DESTINO (pra onde a cena vai).
                    (item.scene.periodo === "NOITE_PARA_DIA" ? PERIODO_BORDER.DIA : PERIODO_BORDER.NOITE)
                  : undefined
              }
              initialObservacoes={item.observacoes}
              initialObservacoesAutoGeradas={item.observacoesAutoGeradas}
              fatorResetPercent={fatorResetPercent}
            />
          )}
        </div>
      )}

      {projectId && (
        <ShotListDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          projectId={projectId}
          sceneId={item.sceneId}
          sceneNumero={item.scene.numero}
          shootDayId={shootDayId}
        />
      )}
    </div>
  );
}
