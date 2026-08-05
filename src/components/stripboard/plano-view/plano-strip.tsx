"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ShotTipoReset } from "@prisma/client";
import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HEAVY_RESETS, RESET_LABEL, resolveEffectiveResetMin } from "@/lib/shots-shared";
import { cn } from "@/lib/utils";

import type { PlanoScheduleEntry } from "./types";

/** Divisor mostrado ANTES de um plano quando há reset em relação ao anterior NA ORDEM DO DIA —
 *  lido direto de `tipoReset`/`tempoResetMin` do ShotSchedule (já recalculado pelo servidor a cada
 *  mutação). Some quando NENHUM; destaque âmbar quando é um reset pesado (HEAVY_RESETS).
 *
 *  Mesma semântica de "tempos de reset configuráveis" do ResetDivider de shots/reset-divider.tsx:
 *  `tempoResetMin` é o computado, `tempoResetMinManual` o ajuste do plano (nível 2), `fatorResetPercent`
 *  o ritmo do dia (nível 3) — o texto mostrado é sempre o valor EFETIVO. */
export function ResetDivider({
  tipoReset,
  tempoResetMin,
  tempoResetMinManual = null,
  fatorResetPercent = 100,
  detail,
  onUpdateManual,
}: {
  tipoReset: ShotTipoReset;
  tempoResetMin: number | null;
  tempoResetMinManual?: number | null;
  fatorResetPercent?: number;
  detail?: string;
  onUpdateManual?: (min: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (tipoReset === "NENHUM") return null;
  const heavy = HEAVY_RESETS.includes(tipoReset);
  const computed = tempoResetMin ?? 0;
  const isManual = tempoResetMinManual != null;
  const base = tempoResetMinManual ?? computed;
  const effective = resolveEffectiveResetMin(computed, tempoResetMinManual, fatorResetPercent);
  const fatorApplied = fatorResetPercent !== 100;

  function startEditing() {
    setDraft(String(base));
    setEditing(true);
  }

  function save() {
    const value = Number(draft);
    if (!Number.isNaN(value) && value >= 0) onUpdateManual?.(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="my-1 ml-2 flex w-fit items-center gap-1.5 rounded px-2 py-0.5 text-[11px]">
        <span className="text-muted-foreground">{RESET_LABEL[tipoReset]}</span>
        <input
          type="number"
          autoFocus
          min={0}
          className="h-6 w-14 rounded border bg-background px-1 text-center text-[11px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={save}
        />
        <span className="text-muted-foreground">min</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "my-1 ml-2 flex w-fit items-center gap-1.5 rounded px-2 py-0.5 text-[11px]",
        heavy ? "border border-amber-400/50 bg-amber-100 text-amber-700" : "text-muted-foreground"
      )}
    >
      {onUpdateManual ? (
        <button type="button" onClick={startEditing} className="hover:underline">
          ↓ {RESET_LABEL[tipoReset]}
          {detail && ` ${detail}`} · +{effective}min
        </button>
      ) : (
        <span>
          ↓ {RESET_LABEL[tipoReset]}
          {detail && ` ${detail}`} · +{effective}min
        </span>
      )}
      {fatorApplied && (
        <Tooltip>
          <TooltipTrigger type="button" className="opacity-70">
            (?)
          </TooltipTrigger>
          <TooltipContent>
            {RESET_LABEL[tipoReset]} · {base}min × {fatorResetPercent}% = {effective}min
          </TooltipContent>
        </Tooltip>
      )}
      {isManual && (
        <>
          <Tooltip>
            <TooltipTrigger className="block h-1.5 w-1.5 shrink-0 rounded-full bg-alerta-accent" />
            <TooltipContent>Tempo manual difere do padrão do projeto</TooltipContent>
          </Tooltip>
          {onUpdateManual && (
            <button type="button" className="underline opacity-80 hover:opacity-100" onClick={() => onUpdateManual(null)}>
              usar padrão
            </button>
          )}
        </>
      )}
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
