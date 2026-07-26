"use client";

import { NewShootDayDialog } from "@/components/stripboard/new-shoot-day-dialog";
import { cn } from "@/lib/utils";

import type { DayState } from "./types";

export function DaySidebar({ projectId, days }: { projectId: string; days: DayState[] }) {
  const nextNumeroDia = days.length ? Math.max(...days.map((d) => d.numeroDia)) + 1 : 1;

  function scrollToDay(id: string) {
    document.getElementById(`shoot-day-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-3 border-r pr-4">
      <NewShootDayDialog projectId={projectId} nextNumeroDia={nextNumeroDia} />
      <nav className="flex flex-col gap-1">
        {days.map((day) => (
          <button
            key={day.id}
            type="button"
            onClick={() => scrollToDay(day.id)}
            className={cn(
              "rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
              "text-muted-foreground hover:text-accent-foreground"
            )}
          >
            <span className="font-medium text-foreground">Diária {day.numeroDia}</span>
            <br />
            <span className="text-xs">
              {new Date(day.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => document.getElementById("boneyard")?.scrollIntoView({ behavior: "smooth" })}
          className="rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          Boneyard
        </button>
      </nav>
    </aside>
  );
}
