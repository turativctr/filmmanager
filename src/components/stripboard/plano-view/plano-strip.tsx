"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ShotTipoReset } from "@prisma/client";

import { HEAVY_RESETS, RESET_LABEL } from "@/lib/shots-shared";
import { cn } from "@/lib/utils";

import type { PlanoScheduleEntry } from "./types";

/** Divisor mostrado ANTES de um plano quando há reset em relação ao anterior NA ORDEM DO DIA —
 *  lido direto de `tipoReset`/`tempoResetMin` do ShotSchedule (já recalculado pelo servidor a cada
 *  mutação). Some quando NENHUM; destaque âmbar quando é um reset pesado (HEAVY_RESETS). */
export function ResetDivider({
  tipoReset,
  tempoResetMin,
  detail,
}: {
  tipoReset: ShotTipoReset;
  tempoResetMin: number | null;
  detail?: string;
}) {
  if (tipoReset === "NENHUM") return null;
  const heavy = HEAVY_RESETS.includes(tipoReset);

  return (
    <div
      className={cn(
        "my-1 ml-2 flex w-fit items-center gap-1 rounded px-2 py-0.5 text-[11px]",
        heavy ? "border border-amber-400/50 bg-amber-100 text-amber-700" : "text-muted-foreground"
      )}
    >
      ↓ {RESET_LABEL[tipoReset]}
      {detail && ` ${detail}`} · +{tempoResetMin ?? 0}min
    </div>
  );
}

export function PlanoStrip({
  entry,
  colorHex,
  onBlocoChange,
  savingBloco,
}: {
  entry: PlanoScheduleEntry;
  colorHex: string;
  onBlocoChange: (scheduleId: string, bloco: "MANHA" | "TARDE" | null) => void;
  savingBloco: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeftWidth: 4,
    borderLeftColor: colorHex,
  };

  const shot = entry.shot;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex cursor-grab items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm shadow-sm active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <span className="w-16 shrink-0 font-mono text-xs font-semibold" title="Cena · Plano">
        C{shot.scene.numero}·P{shot.numero}
      </span>
      <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={shot.tamanho ?? undefined}>
        {shot.tamanho ?? "—"}
      </span>
      <span className="w-20 shrink-0 truncate text-xs text-muted-foreground" title={shot.lente ?? undefined}>
        {shot.lente ?? "—"}
      </span>
      <span className="flex-1 truncate text-muted-foreground" title={shot.descricao}>
        {shot.descricao}
      </span>
      <span
        className="w-28 shrink-0 truncate text-right text-xs text-muted-foreground"
        title={`${shot.takesPrevistos}T × ${shot.duracaoTakeMin}min${shot.tempoSetupMin ? ` + ${shot.tempoSetupMin}min` : ""} = ${shot.tempoTotalMin}min`}
      >
        {shot.takesPrevistos}T×{shot.duracaoTakeMin}
        {shot.tempoSetupMin ? `+${shot.tempoSetupMin}` : ""} {shot.tempoTotalMin}min
      </span>
      <span
        className="shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <select
          value={entry.bloco ?? ""}
          disabled={savingBloco}
          onChange={(e) => onBlocoChange(entry.id, e.target.value === "" ? null : (e.target.value as "MANHA" | "TARDE"))}
          className="h-7 rounded border bg-background px-1 text-xs disabled:opacity-50"
          title="Bloco (manhã/tarde)"
        >
          <option value="">—</option>
          <option value="MANHA">Manhã</option>
          <option value="TARDE">Tarde</option>
        </select>
      </span>
    </div>
  );
}
