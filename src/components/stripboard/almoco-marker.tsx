"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { formatHHh } from "@/lib/schedule";
import { cn } from "@/lib/utils";

import { almocoMarkerId } from "./types";

import type { AlmocoValidation } from "@/lib/schedule";

/** Marcador de almoço — item arrastável dentro da MESMA lista sortable das cenas do dia (ver
 *  ShootDayColumn/StripboardBoard): manhã/tarde não são mais definidas, são consequência de quantas
 *  cenas ficam antes/depois deste marcador. Cor âmbar sutil por padrão, intensifica pra âmbar cheio
 *  ("perto do limite") e vermelho ("acima do limite") conforme validateAlmocoTiming — nunca bloqueia
 *  a ação, só avisa (o AD pode ter motivo pra estourar; o sistema avisa e ele decide). */
export function AlmocoMarker({
  dayId,
  almocoInicio,
  duracaoAlmocoMin,
  validation,
  draggable = true,
}: {
  dayId: string;
  almocoInicio: string | null;
  duracaoAlmocoMin: number;
  validation: AlmocoValidation;
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: almocoMarkerId(dayId),
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium",
        validation.status === "acima"
          ? "border-erro-accent bg-erro-bg text-erro-fg"
          : validation.status === "perto"
            ? "border-alerta-accent bg-alerta-bg text-alerta-fg"
            : "border-alerta-accent/30 bg-alerta-bg/40 text-alerta-fg"
      )}
    >
      {draggable && (
        <button
          type="button"
          className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <span>
        Almoço{almocoInicio ? ` · ${formatHHh(almocoInicio)}` : ""} · {duracaoAlmocoMin}min
      </span>
      {validation.mensagem && <span className="ml-auto truncate font-normal italic">{validation.mensagem}</span>}
    </div>
  );
}
