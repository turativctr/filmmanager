"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StripDropZone({
  id,
  itemIds,
  children,
  emptyLabel,
  isEmpty,
}: {
  id: string;
  itemIds: string[];
  children: ReactNode;
  emptyLabel?: string;
  /** Quando omitido, considera vazio se itemIds.length === 0 — mas o Stripboard de diária sempre tem
   *  pelo menos o marcador de almoço em itemIds, então passa isso explicitamente (vazio = sem cenas). */
  isEmpty?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const empty = isEmpty ?? itemIds.length === 0;

  return (
    <SortableContext id={id} items={itemIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn("min-h-[3.5rem] rounded-md transition-colors", isOver && "bg-accent")}
      >
        {empty ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {emptyLabel ?? "Arraste cenas para cá"}
          </p>
        ) : (
          // Sem overflow-x-auto/min-w-max: a tira agora cabe na largura do container por design (o
          // único campo que pode encolher é o SET, via truncate) — rolagem horizontal era exatamente
          // o problema que a redução de largura da tira resolveu.
          <div className="space-y-1.5 p-1.5">{children}</div>
        )}
      </div>
    </SortableContext>
  );
}
