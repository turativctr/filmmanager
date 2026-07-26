"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { addMonths, formatMinutos, MONTH_NAMES, WEEKDAY_NAMES } from "@/lib/calendar-grid";
import { getCharacterId } from "@/lib/character-id";
import { formatPaginas } from "@/lib/paginas";
import { cn } from "@/lib/utils";

import { CalendarBadge } from "./calendar-badge";
import { DayDetailDialog } from "./day-detail-dialog";
import { DraggableBadge, type CalendarDragData } from "./draggable-badge";
import { NewEventDialog } from "./new-event-dialog";
import type { CalendarDayData, CalendarMonthSummary } from "./types";

type CharacterOption = { id: string; idCurto: string; numeroElenco: number | null; personagem: string };
type SistemaIdElenco = "ID_CURTO" | "NUMERACAO";

const MAX_ELENCO_BADGES = 4;

function elencoLine(day: CalendarDayData, sistemaIdElenco: SistemaIdElenco): string | null {
  const ids = day.shootDay?.castPresente.map((c) => getCharacterId(c, { sistemaIdElenco })) ?? [];
  if (ids.length === 0) return null;
  if (ids.length <= MAX_ELENCO_BADGES) return ids.join(" · ");
  return `${ids.slice(0, MAX_ELENCO_BADGES).join(" · ")} +${ids.length - MAX_ELENCO_BADGES}`;
}

function moveShootDay(days: CalendarDayData[], originDateKey: string, targetDateKey: string): CalendarDayData[] {
  const origin = days.find((d) => d.dateKey === originDateKey);
  if (!origin?.shootDay) return days;
  const shootDay = origin.shootDay;

  return days.map((day) => {
    if (day.dateKey === originDateKey) return { ...day, shootDay: null };
    if (day.dateKey === targetDateKey) return { ...day, shootDay };
    return day;
  });
}

function moveEvent(
  days: CalendarDayData[],
  originDateKey: string,
  targetDateKey: string,
  eventId: string
): CalendarDayData[] {
  const origin = days.find((d) => d.dateKey === originDateKey);
  const event = origin?.events.find((e) => e.id === eventId);
  if (!event) return days;

  return days.map((day) => {
    if (day.dateKey === originDateKey) {
      return { ...day, events: day.events.filter((e) => e.id !== eventId) };
    }
    if (day.dateKey === targetDateKey) {
      return { ...day, events: [...day.events, event] };
    }
    return day;
  });
}

function DayCell({
  day,
  activeDrag,
  sistemaIdElenco,
  onOpen,
}: {
  day: CalendarDayData;
  activeDrag: CalendarDragData | null;
  sistemaIdElenco: SistemaIdElenco;
  onOpen: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day.dateKey, data: { dateKey: day.dateKey } });

  const blockedForShootDay =
    activeDrag?.type === "shootday" && day.shootDay != null && day.shootDay.id !== activeDrag.shootDayId;
  const hasEvent = day.events.length > 0;

  let dragClass = "";
  if (activeDrag) {
    if (blockedForShootDay) {
      dragClass = isOver ? "border-red-400 bg-red-100" : "border-red-200 bg-red-50/60";
    } else if (hasEvent) {
      dragClass = isOver ? "border-amber-400 bg-amber-100" : "border-amber-200 bg-amber-50/60";
    } else {
      dragClass = isOver ? "border-blue-400 bg-blue-100" : "border-blue-200 bg-blue-50/40";
    }
  }

  const elenco = elencoLine(day, sistemaIdElenco);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[7rem] flex-col gap-1 rounded-md border p-1.5 text-left align-top transition-colors",
        day.isCurrentMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
        dragClass
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "text-left text-xs font-medium",
          (day.shootDay || day.events.length > 0) && "hover:underline"
        )}
      >
        {day.dayNumber}
      </button>

      {day.shootDay && (
        <DraggableBadge
          id={`shootday:${day.shootDay.id}`}
          variant="shootday"
          data={{
            type: "shootday",
            shootDayId: day.shootDay.id,
            numeroDia: day.shootDay.numeroDia,
            originDateKey: day.dateKey,
          }}
        >
          Dia {day.shootDay.numeroDia}
          {day.shootDay.locacao ? ` · ${day.shootDay.locacao}` : ""}
        </DraggableBadge>
      )}
      {day.shootDay && (
        <div className="space-y-0.5 text-[10px] leading-tight text-muted-foreground">
          <p>{formatPaginas(day.shootDay.totalPaginas)} pág.</p>
          <p>{formatMinutos(day.shootDay.totalMinutos)}</p>
          {elenco && <p className="truncate" title={elenco}>{elenco}</p>}
        </div>
      )}

      {day.events.map((event) => (
        <DraggableBadge
          key={event.id}
          id={`event:${event.id}`}
          variant={event.tipo}
          data={{
            type: "event",
            eventId: event.id,
            tipo: event.tipo,
            nome: event.nome,
            originDateKey: day.dateKey,
          }}
        >
          {event.nome}
        </DraggableBadge>
      ))}
    </div>
  );
}

export function CalendarBoard({
  projectId,
  year,
  month,
  days: initialDays,
  characters,
  sistemaIdElenco,
  monthSummary,
  projeto,
}: {
  projectId: string;
  year: number;
  month: number;
  days: CalendarDayData[];
  characters: CharacterOption[];
  sistemaIdElenco: SistemaIdElenco;
  monthSummary: CalendarMonthSummary;
  projeto: { titulo: string; sigla: string | null };
}) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  const [selectedDay, setSelectedDay] = useState<CalendarDayData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<CalendarDragData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setDays(initialDays), [initialDays]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);

  function openDay(day: CalendarDayData) {
    if (!day.shootDay && day.events.length === 0) return;
    setSelectedDay(day);
    setDetailOpen(true);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDrag((event.active.data.current as CalendarDragData) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const drag = activeDrag;
    setActiveDrag(null);
    const { over } = event;
    if (!over || !drag) return;

    const targetDateKey = String(over.id);
    if (targetDateKey === drag.originDateKey) return;

    if (drag.type === "shootday") {
      const target = days.find((d) => d.dateKey === targetDateKey);
      if (target?.shootDay && target.shootDay.id !== drag.shootDayId) return;

      setDays((prevDays) => moveShootDay(prevDays, drag.originDateKey, targetDateKey));
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${drag.shootDayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroDia: drag.numeroDia, data: targetDateKey }),
      });
      if (!res.ok) router.refresh();
    } else {
      setDays((prevDays) => moveEvent(prevDays, drag.originDateKey, targetDateKey, drag.eventId));
      const res = await fetch(`/api/projects/${projectId}/calendar-events/${drag.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: targetDateKey, tipo: drag.tipo, nome: drag.nome }),
      });
      if (!res.ok) router.refresh();
    }
  }

  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={`?month=${prev.month}&year=${prev.year}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h2 className="w-40 text-center text-lg font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <Button variant="outline" size="icon" asChild>
          <Link href={`?month=${next.month}&year=${next.year}`}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <NewEventDialog projectId={projectId} characters={characters} sistemaIdElenco={sistemaIdElenco} />
    </div>
  );

  const summary = (
    <Card>
      <CardContent className="flex flex-wrap gap-6 p-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Dias de filmagem</p>
          <p className="font-semibold">{monthSummary.totalDiasFilmagem}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Oitavas no mês</p>
          <p className="font-semibold">{formatPaginas(monthSummary.totalPaginas)} pág.</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Horas estimadas</p>
          <p className="font-semibold">{formatMinutos(monthSummary.totalMinutos)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cenas agendadas</p>
          <p className="font-semibold">{monthSummary.totalCenas}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (!mounted) {
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Carregando calendário...
          </CardContent>
        </Card>
        {summary}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <DndContext id="calendar" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Card>
          <CardContent className="p-2">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_NAMES.map((label) => (
                <div key={label} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {label}
                </div>
              ))}

              {days.map((day) => (
                <DayCell
                  key={day.dateKey}
                  day={day}
                  activeDrag={activeDrag}
                  sistemaIdElenco={sistemaIdElenco}
                  onOpen={() => openDay(day)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <DragOverlay>
          {activeDrag && (
            <CalendarBadge variant={activeDrag.type === "shootday" ? "shootday" : activeDrag.tipo}>
              {activeDrag.type === "shootday" ? `Dia ${activeDrag.numeroDia}` : activeDrag.nome}
            </CalendarBadge>
          )}
        </DragOverlay>
      </DndContext>

      {summary}

      <DayDetailDialog
        projectId={projectId}
        day={selectedDay}
        sistemaIdElenco={sistemaIdElenco}
        projeto={projeto}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
