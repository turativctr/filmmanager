"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ShotStatus = "PENDENTE" | "FILMADO" | "DESCARTADO";

type Shot = {
  id: string;
  ordem: number;
  numero: string;
  descricao: string;
  tamanho: string | null;
  lente: string | null;
  angulo: string | null;
  movimento: string | null;
  tempoEstimadoMin: number | null;
  tempoResetMin: number | null;
  tipoReset: string;
  notasDirecao: string | null;
  notasContinuidade: string | null;
  status: ShotStatus;
};

const STATUS_LABEL: Record<ShotStatus, string> = {
  PENDENTE: "Pendente",
  FILMADO: "Filmado",
  DESCARTADO: "Descartado",
};

const STATUS_BADGE_CLASS: Record<ShotStatus, string> = {
  PENDENTE: "border-transparent bg-secondary text-secondary-foreground",
  FILMADO: "border-transparent bg-emerald-100 text-emerald-900",
  DESCARTADO: "border-transparent bg-muted text-muted-foreground",
};

export function ShotListDrawer({
  open,
  onOpenChange,
  projectId,
  sceneId,
  sceneNumero,
  shootDayId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sceneId: string;
  sceneNumero: string;
  shootDayId?: string;
}) {
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [markingScene, setMarkingScene] = useState(false);
  const [sceneMarked, setSceneMarked] = useState(false);

  // Recarrega a lista de planos toda vez que a gaveta é aberta — mantém os dados frescos
  // mesmo se outra aba/sessão tiver editado os planos entre uma abertura e outra.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setSceneMarked(false);

    fetch(`/api/projects/${projectId}/scenes/${sceneId}/shots`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data: Shot[]) => {
        if (!cancelled) setShots(data);
      })
      .catch((err) => {
        console.error("Erro ao carregar planos:", err);
        if (!cancelled) toast.error("Erro ao carregar planos — tente novamente");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectId, sceneId]);

  const activeShots = (shots ?? []).filter((s) => s.status !== "DESCARTADO");
  const filmedCount = activeShots.filter((s) => s.status === "FILMADO").length;
  const totalActive = activeShots.length;
  const allFilmed = totalActive > 0 && filmedCount === totalActive;

  async function markFilmado(shotId: string) {
    const previous = shots;
    setSavingId(shotId);
    setShots((prev) => prev?.map((s) => (s.id === shotId ? { ...s, status: "FILMADO" as const } : s)) ?? prev);

    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/shots/${shotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FILMADO" }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const updated: Shot[] = await res.json();
      setShots(updated);
    } catch (err) {
      console.error("Erro ao marcar plano como filmado:", err);
      toast.error("Erro ao salvar — tente novamente");
      setShots(previous ?? null);
    } finally {
      setSavingId(null);
    }
  }

  async function markSceneConcluida() {
    if (!shootDayId) return;
    setMarkingScene(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/shoot-days/${shootDayId}/scenes/${sceneId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CONCLUIDA" }),
        }
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSceneMarked(true);
    } catch (err) {
      console.error("Erro ao marcar cena como concluída:", err);
      toast.error("Erro ao salvar — tente novamente");
    } finally {
      setMarkingScene(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Planos — Cena {sceneNumero}</SheetTitle>
          <SheetDescription>
            {shots ? `${filmedCount}/${totalActive} planos filmados` : "Carregando..."}
          </SheetDescription>
        </SheetHeader>

        {allFilmed && shootDayId && !sceneMarked && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="mb-2">Todos os planos foram filmados. Marcar cena como concluída?</p>
            <Button size="sm" onClick={markSceneConcluida} disabled={markingScene}>
              {markingScene ? "Salvando..." : "Marcar cena como concluída"}
            </Button>
          </div>
        )}
        {sceneMarked && <p className="text-sm text-emerald-700">Cena marcada como concluída.</p>}

        <div className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Carregando planos...</p>}
          {!loading && shots?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum plano cadastrado para esta cena.</p>
          )}
          {shots?.map((shot) => (
            <div key={shot.id} className="rounded-md border p-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-semibold">{shot.numero}</span>
                  {shot.tamanho && <span className="text-muted-foreground"> · {shot.tamanho}</span>}
                  {shot.lente && <span className="text-muted-foreground"> · {shot.lente}</span>}
                </div>
                <Badge className={cn("shrink-0 text-[10px]", STATUS_BADGE_CLASS[shot.status])}>
                  {STATUS_LABEL[shot.status]}
                </Badge>
              </div>
              {shot.descricao && <p className="mt-1 text-muted-foreground">{shot.descricao}</p>}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {shot.tempoEstimadoMin != null ? `${shot.tempoEstimadoMin}min` : "—"}
                </span>
                {shot.status !== "FILMADO" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markFilmado(shot.id)}
                    disabled={savingId === shot.id}
                  >
                    {savingId === shot.id ? "Salvando..." : "Marcar filmado"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
