"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPaginas } from "@/lib/paginas";
import { computeDayProgress, isShootDayToday, type SceneShootDayStatusValue } from "@/lib/scene-progress";
import { cn } from "@/lib/utils";

type SceneProgressRow = {
  sceneId: string;
  numero: string;
  paginas: number;
  status: SceneShootDayStatusValue;
  horaInicioReal: string | null;
  horaFimReal: string | null;
};

const STATUS_LABEL: Record<SceneShootDayStatusValue, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  ADIADA: "Adiada",
};

const STATUS_BADGE_CLASS: Record<SceneShootDayStatusValue, string> = {
  PENDENTE: "bg-muted text-muted-foreground",
  EM_ANDAMENTO: "bg-blue-100 text-blue-900",
  CONCLUIDA: "bg-emerald-100 text-emerald-900",
  ADIADA: "bg-amber-100 text-amber-900",
};

function nextStatus(current: SceneShootDayStatusValue): SceneShootDayStatusValue {
  if (current === "PENDENTE") return "EM_ANDAMENTO";
  if (current === "EM_ANDAMENTO") return "CONCLUIDA";
  return "PENDENTE";
}

function actionLabel(current: SceneShootDayStatusValue): string {
  if (current === "PENDENTE") return "Iniciar";
  if (current === "EM_ANDAMENTO") return "Concluir";
  return "Reiniciar";
}

export function SceneProgressPanel({
  projectId,
  shootDayId,
  data,
  chamadaGeral,
  desprodInicio,
  initialScenes,
}: {
  projectId: string;
  shootDayId: string;
  data: string;
  chamadaGeral: string | null;
  desprodInicio: string | null;
  initialScenes: SceneProgressRow[];
}) {
  const [scenes, setScenes] = useState(initialScenes);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const today = isShootDayToday(new Date(data), now);

  const progress = useMemo(
    () =>
      computeDayProgress(
        scenes.map((s) => ({ paginas: s.paginas, status: s.status })),
        {
          chamadaGeral,
          desprodInicio,
          nowMin: today ? now.getHours() * 60 + now.getMinutes() : null,
        }
      ),
    [scenes, chamadaGeral, desprodInicio, today, now]
  );

  async function setStatus(sceneId: string, status: SceneShootDayStatusValue) {
    const previous = scenes;
    setScenes((cur) => cur.map((s) => (s.sceneId === sceneId ? { ...s, status } : s)));

    const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/scenes/${sceneId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      setScenes(previous);
      return;
    }
    const updated = await res.json();
    setScenes((cur) =>
      cur.map((s) =>
        s.sceneId === sceneId
          ? { ...s, status: updated.status, horaInicioReal: updated.horaInicioReal, horaFimReal: updated.horaFimReal }
          : s
      )
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Progresso em tempo real</p>
          {!today && (
            <span className="text-xs text-muted-foreground">
              Estimativa de ritmo disponível apenas no dia da filmagem.
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Cenas concluídas</p>
            <p className="text-xl font-semibold">
              {progress.cenasConcluidas}/{progress.totalCenas}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Oitavas concluídas</p>
            <p className="text-xl font-semibold">
              {formatPaginas(progress.paginasConcluidas)} de {formatPaginas(progress.paginasTotais)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ritmo atual</p>
            <p className="text-xl font-semibold">
              {progress.estimativa ? `${formatPaginas(progress.estimativa.paginasPorHora)}/h` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Término estimado</p>
            <p className="text-xl font-semibold">
              {progress.estimativa ? progress.estimativa.horarioEstimadoTermino : "—"}
              {progress.estimativa?.deltaMin != null && (
                <span
                  className={cn(
                    "ml-1.5 text-xs font-normal",
                    progress.estimativa.deltaMin > 0 ? "text-destructive" : "text-emerald-700"
                  )}
                >
                  {progress.estimativa.deltaMin > 0 ? "+" : ""}
                  {progress.estimativa.deltaMin}min
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress.percentualConcluido}%` }} />
        </div>

        <div className="space-y-1.5">
          {scenes.map((s) => (
            <div key={s.sceneId} className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5">
              <span className="shrink-0 text-sm font-medium">Cena {s.numero}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatPaginas(s.paginas)} pág.</span>
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_BADGE_CLASS[s.status])}>
                {STATUS_LABEL[s.status]}
              </span>
              {(s.horaInicioReal || s.horaFimReal) && (
                <span className="text-[10px] text-muted-foreground">
                  {s.horaInicioReal ?? "—"} - {s.horaFimReal ?? "—"}
                </span>
              )}
              <div className="ml-auto flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => setStatus(s.sceneId, nextStatus(s.status))}
                >
                  {actionLabel(s.status)}
                </Button>
                {s.status !== "ADIADA" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setStatus(s.sceneId, "ADIADA")}
                  >
                    Adiar
                  </Button>
                )}
              </div>
            </div>
          ))}
          {scenes.length === 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">Nenhuma cena agendada nesta diária.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
