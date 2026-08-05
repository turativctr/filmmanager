"use client";

import { Check, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

import type { CalendarTaskSummary } from "./types";

/** Tarefa no grid do Calendário — distinta de diária/evento: círculo vazio (pendente, futura),
 *  check (concluída), token `erro` (pendente e já vencida). Clique alterna concluída, sem abrir
 *  diálogo — mesmo padrão de toggle rápido usado em SceneProgressPanel. */
export function TaskBadge({ projectId, task, atrasada }: { projectId: string; task: CalendarTaskSummary; atrasada: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concluida: !task.concluida }),
      });
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void toggle();
      }}
      disabled={pending}
      title={task.responsavel ? `${task.titulo} · ${task.responsavel}` : task.titulo}
      className={cn(
        "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-[10px] leading-tight",
        task.concluida
          ? "text-muted-foreground line-through"
          : atrasada
            ? "bg-erro-bg text-erro-fg"
            : "text-foreground"
      )}
    >
      {task.concluida ? (
        <Check className="h-2.5 w-2.5 shrink-0" />
      ) : (
        <Circle className="h-2 w-2 shrink-0" />
      )}
      <span className="truncate">{task.titulo}</span>
    </button>
  );
}
