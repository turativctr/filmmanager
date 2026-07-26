"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ChevronDown, ChevronRight, GripVertical, StickyNote } from "lucide-react";
import { useEffect, useState } from "react";

import { ScenePlanosPanel } from "@/components/stripboard/scene-planos-panel";
import { ShotListDrawer } from "@/components/stripboard/shot-list-drawer";
import { Badge } from "@/components/ui/badge";
import { formatPaginas } from "@/lib/paginas";
import { formatHHh } from "@/lib/schedule";
import { cn } from "@/lib/utils";

import type { ComputedSchedule } from "@/lib/schedule";
import type { StripItem } from "./types";

const PERIODO_BG: Record<string, string> = {
  DIA: "#E6F1FB",
  ENTARDECER: "#EEEDFE",
  NOITE: "#F1EFE8",
  AMANHECER: "#FFF3E0",
  CONTINUO: "#ECEFF1",
  DEPOIS: "#ECEFF1",
};

const PERIODO_LABEL: Record<string, string> = {
  DIA: "Dia",
  NOITE: "Noite",
  ENTARDECER: "Entardecer",
  AMANHECER: "Amanhecer",
  CONTINUO: "Contínuo",
  DEPOIS: "Depois",
};

export function StripCard({
  item,
  characterLabels,
  schedule,
  conflicts,
  neutral,
  onUpdateTimes,
  projectId,
  shootDayId,
}: {
  item: StripItem;
  characterLabels: string[];
  schedule?: ComputedSchedule | null;
  conflicts?: string[];
  neutral?: boolean;
  onUpdateTimes?: (prepMin: number | null, rodMin: number | null) => void;
  projectId?: string;
  shootDayId?: string;
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
    backgroundColor: neutral || !item.scene.periodo ? undefined : PERIODO_BG[item.scene.periodo],
    opacity: isDragging ? 0.5 : 1,
  };

  const hasConflict = Boolean(conflicts?.length);
  const isOmitida = item.scene.omitida;
  // Card fantasma do DragOverlay não recebe onUpdateTimes — evita mostrar o aviso nele.
  const showTempoBadge = !neutral && Boolean(onUpdateTimes) && (item.prepMin ?? 0) === 0 && (item.rodMin ?? 0) === 0;
  const hasShots = Boolean(item.shotsSummary && item.shotsSummary.count > 0);
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border text-sm shadow-sm",
        neutral && "bg-muted/60",
        (hasConflict || isOmitida) && "border-destructive"
      )}
    >
      <div
        className={cn("flex items-center gap-3 px-3 py-2", canExpand && "cursor-pointer")}
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
      <span className="w-10 shrink-0 font-bold">{item.scene.numero}</span>
      {isOmitida && (
        <span
          className="shrink-0 rounded border border-destructive/40 bg-destructive/10 px-1 py-0.5 text-[10px] font-semibold text-destructive"
          title="Esta cena foi removida (OMITIDA) numa revisão mais recente do roteiro, mas ainda está agendada aqui."
        >
          OMITIDA
        </span>
      )}
      {showTempoBadge && (
        <span
          className="shrink-0 rounded border border-amber-400/50 bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700"
          title="Prep e Rod não foram definidos para esta cena — o horário exibido usa valores padrão."
        >
          ! Tempo não definido
        </span>
      )}
      {showTempoManualBadge && (
        <span
          className="flex shrink-0 items-center gap-1 rounded border border-amber-400/50 bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          Tempo manual — planos somam {item.shotsSummary!.totalMin}min
          <button
            type="button"
            className="rounded border border-amber-400/60 bg-amber-200/70 px-1 py-0.5 font-semibold hover:bg-amber-200"
            onClick={() => onUpdateTimes?.(item.prepMin, item.shotsSummary!.totalMin)}
          >
            Usar tempo dos planos
          </button>
        </span>
      )}
      <span className="w-9 shrink-0 text-xs text-muted-foreground">{item.scene.tipo ?? "—"}</span>
      <span className="w-28 shrink-0 truncate" title={item.scene.set ?? undefined}>
        {item.scene.set ?? item.scene.locacao ?? "—"}
      </span>
      <span className="w-48 shrink-0 truncate text-muted-foreground" title={item.scene.sinopse ?? undefined}>
        {item.scene.sinopse ?? "—"}
      </span>
      <span className="flex w-28 shrink-0 flex-wrap gap-1">
        {characterLabels.map((label) => (
          <Badge key={label} variant="secondary" className="text-[10px]">
            {label}
          </Badge>
        ))}
      </span>
      <span className="w-12 shrink-0 text-xs">{formatPaginas(item.scene.paginas)}</span>
      {hasShots && projectId && (
        <Badge
          variant="outline"
          className="shrink-0 cursor-pointer text-[10px] hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation();
            setDrawerOpen(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          title="Ver planos desta cena"
        >
          {item.shotsSummary!.count} planos · {item.shotsSummary!.takesTotal} takes
        </Badge>
      )}
      <span
        className="w-24 shrink-0 truncate text-xs text-muted-foreground"
        title={hasShots ? `${item.shotsSummary!.totalMin}min (${item.shotsSummary!.count} planos)` : undefined}
      >
        {hasShots
          ? `${item.shotsSummary!.totalMin}min (${item.shotsSummary!.count} planos)`
          : item.scene.tempoEstimadoMin != null
            ? `${item.scene.tempoEstimadoMin} min`
            : "—"}
      </span>
      {item.scene.diaNarrativo != null && (
        <Badge variant="outline" className="shrink-0">
          Dia {item.scene.diaNarrativo}
        </Badge>
      )}

      {onUpdateTimes && (
        <span
          className="flex shrink-0 items-center gap-1 text-xs"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <label className="text-muted-foreground">Prep</label>
          <input
            type="number"
            className="w-12 rounded border bg-background px-1 py-0.5"
            value={prepDraft}
            onChange={(e) => setPrepDraft(e.target.value)}
            onBlur={commitTimes}
          />
          <label className="text-muted-foreground">Rod</label>
          <input
            type="number"
            className="w-12 rounded border bg-background px-1 py-0.5"
            value={rodDraft}
            onChange={(e) => setRodDraft(e.target.value)}
            onBlur={commitTimes}
          />
        </span>
      )}

      {schedule && (
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          Prep: {formatHHh(schedule.prepStart)} às {formatHHh(schedule.prepEnd)} · Rod:{" "}
          {formatHHh(schedule.rodStart)} às {formatHHh(schedule.rodEnd)}
        </span>
      )}

      <span className="ml-auto shrink-0 text-[10px] uppercase text-muted-foreground">
        {item.scene.periodo ? PERIODO_LABEL[item.scene.periodo] ?? item.scene.periodo : "—"}
      </span>

      {item.scene.notasAD && (
        <span title={`Nota do AD: ${item.scene.notasAD}`}>
          <StickyNote className="h-4 w-4 shrink-0 text-amber-600" />
        </span>
      )}

      {hasConflict && (
        <span title={conflicts!.join("\n")}>
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        </span>
      )}
      </div>

      {expanded && canExpand && (
        <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
          <ScenePlanosPanel
            projectId={projectId!}
            sceneId={item.sceneId}
            shootDayId={shootDayId}
            periodoColor={item.scene.periodo ? PERIODO_BG[item.scene.periodo] : undefined}
            initialObservacoes={item.observacoes}
            initialObservacoesAutoGeradas={item.observacoesAutoGeradas}
          />
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
