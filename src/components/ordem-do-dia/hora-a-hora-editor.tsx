"use client";

import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { HoraAHoraEventTipo } from "@prisma/client";
import { Download, GripVertical, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  HoraAHoraEventDialog,
  type HoraAHoraEventDefaults,
} from "@/components/ordem-do-dia/hora-a-hora-event-dialog";
import { HORA_A_HORA_TIPO_LABELS } from "@/lib/hora-a-hora";
import { formatHHh } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type HoraAHoraEventRow = HoraAHoraEventDefaults & { geradoAutomaticamente: boolean; ordem: number };

const TIPO_ROW_CLASS: Record<HoraAHoraEventTipo, string> = {
  CHAMADA_EQUIPE: "bg-slate-100",
  CHAMADA_ELENCO: "bg-blue-50",
  SETUP: "bg-yellow-50",
  ENSAIO: "bg-orange-50",
  RODANDO: "bg-green-50 font-medium",
  ALMOCO: "bg-slate-200",
  SAIDA: "italic",
  DESPRODUCAO: "bg-slate-700 text-white",
  OUTRO: "",
};

function SortableEventRow({
  event,
  projectId,
  shootDayId,
  onSaved,
  onDelete,
}: {
  event: HoraAHoraEventRow;
  projectId: string;
  shootDayId: string;
  onSaved: (event: HoraAHoraEventRow) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={cn(
        "flex items-center gap-3 rounded-md border px-2 py-2",
        TIPO_ROW_CLASS[event.tipo],
        event.geradoAutomaticamente && "border-dashed"
      )}
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="w-28 shrink-0 text-sm tabular-nums">
        {formatHHh(event.horaInicio)}
        {event.horaFim ? ` – ${formatHHh(event.horaFim)}` : ""}
      </div>
      <div className="flex-1 text-sm">{event.descricao}</div>
      <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
        {HORA_A_HORA_TIPO_LABELS[event.tipo]}
      </span>
      {event.geradoAutomaticamente && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">automático</span>
      )}
      <div className="flex shrink-0 gap-1">
        <HoraAHoraEventDialog
          projectId={projectId}
          shootDayId={shootDayId}
          event={event}
          onSaved={onSaved}
          trigger={
            <Button variant="ghost" size="icon" title="Editar evento">
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
        <Button variant="ghost" size="icon" title="Remover evento" onClick={() => onDelete(event.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function HoraAHoraEditor({
  projectId,
  shootDayId,
  numeroDia,
  initialEvents,
}: {
  projectId: string;
  shootDayId: string;
  numeroDia: number;
  initialEvents: HoraAHoraEventRow[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [regenerating, setRegenerating] = useState(false);
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  function upsert(event: HoraAHoraEventRow) {
    setEvents((prev) => {
      const exists = prev.some((e) => e.id === event.id);
      const next = exists ? prev.map((e) => (e.id === event.id ? event : e)) : [...prev, event];
      return next.sort((a, b) => a.ordem - b.ordem);
    });
  }

  async function handleDelete(eventId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/hora-a-hora/${eventId}`, { method: "DELETE" });
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = events.findIndex((ev) => ev.id === active.id);
    const newIndex = events.findIndex((ev) => ev.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(events, oldIndex, newIndex);
    setEvents(reordered);

    await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/hora-a-hora/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventIds: reordered.map((ev) => ev.id) }),
    });
  }

  async function regenerate() {
    setRegenerating(true);
    await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/hora-a-hora/regenerate`, { method: "POST" });
    setRegenerating(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Hora a Hora — Diária {numeroDia}</p>
            <p className="text-xs text-muted-foreground">
              Eventos automáticos (borda tracejada) vêm do Stripboard — arraste para reordenar.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/projects/${projectId}/reports/hora-a-hora?day=${shootDayId}`} target="_blank" rel="noreferrer">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Baixar PDF
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", regenerating && "animate-spin")} />
              Regenerar automáticos
            </Button>
            <HoraAHoraEventDialog projectId={projectId} shootDayId={shootDayId} onSaved={upsert} />
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={events.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {events.map((event) => (
                <SortableEventRow
                  key={event.id}
                  event={event}
                  projectId={projectId}
                  shootDayId={shootDayId}
                  onSaved={upsert}
                  onDelete={handleDelete}
                />
              ))}
              {events.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum evento ainda — use &quot;Regenerar automáticos&quot; ou adicione manualmente.
                </p>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
