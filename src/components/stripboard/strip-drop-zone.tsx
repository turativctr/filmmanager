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
}: {
  id: string;
  itemIds: string[];
  children: ReactNode;
  emptyLabel?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <SortableContext id={id} items={itemIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn("min-h-[3.5rem] rounded-md transition-colors", isOver && "bg-accent")}
      >
        {itemIds.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {emptyLabel ?? "Arraste cenas para cá"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-max space-y-1.5 p-1.5">{children}</div>
          </div>
        )}
      </div>
    </SortableContext>
  );
}
