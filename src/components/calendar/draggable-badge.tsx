"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";

import { CalendarBadge } from "./calendar-badge";
import type { CalendarEventType } from "./types";

export type CalendarDragData =
  | { type: "shootday"; shootDayId: string; numeroDia: number; originDateKey: string }
  | { type: "event"; eventId: string; tipo: CalendarEventType; nome: string; originDateKey: string };

export function DraggableBadge({
  id,
  data,
  variant,
  children,
}: {
  id: string;
  data: CalendarDragData;
  variant: "shootday" | CalendarEventType;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-50")}
      {...attributes}
      {...listeners}
    >
      <CalendarBadge variant={variant}>{children}</CalendarBadge>
    </div>
  );
}
