"use client";

import { CheckCircle2, ChevronDown, ChevronUp, LogOut, MessageSquarePlus, RefreshCw, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { timeToMinutes } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type ShotStatus = "PENDENTE" | "FILMADO" | "DESCARTADO";
type SceneStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "ADIADA";

export type SetModeShot = {
  id: string;
  numero: string;
  tamanho: string | null;
  movimento: string | null;
  descricao: string;
  takesPrevistos: number;
  duracaoTakeMin: number;
  status: ShotStatus;
  notasDirecao: string | null;
};

export type SetModeScene = {
  sceneId: string;
  numero: string;
  setLocacaoDisplay: string;
  sinopseAD: string;
  status: SceneStatus;
  shots: SetModeShot[];
};

const SCENE_STATUS_LABEL: Record<SceneStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Filmando",
  CONCLUIDA: "Concluída",
  ADIADA: "Adiada",
};

// Mesma paleta de cor usada em SceneProgressPanel (src/components/ordem-do-dia/scene-progress-panel.tsx)
// pra manter o Modo de Set visualmente consistente com o resto do app.
const SCENE_STATUS_BADGE_CLASS: Record<SceneStatus, string> = {
  PENDENTE: "bg-muted text-muted-foreground",
  EM_ANDAMENTO: "bg-blue-100 text-blue-900",
  CONCLUIDA: "bg-emerald-100 text-emerald-900",
  ADIADA: "bg-amber-100 text-amber-900",
};

function formatElapsed(chamadaGeral: string | null, now: Date): string | null {
  if (!chamadaGeral) return null;
  const chamadaMin = timeToMinutes(chamadaGeral);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let elapsed = nowMin - chamadaMin;
  if (elapsed < 0) elapsed += 24 * 60;
  const h = Math.floor(elapsed / 60);
  const m = elapsed % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

function offlineAwareErrorMessage(): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "Sem conexão — a alteração não foi salva.";
  }
  return "Erro ao salvar — tente novamente.";
}

export function SetModeView({
  projectId,
  shootDayId,
  projetoTitulo,
  numeroDia,
  data,
  chamadaGeral,
  initialScenes,
}: {
  projectId: string;
  shootDayId: string;
  projetoTitulo: string;
  numeroDia: number;
  data: string;
  chamadaGeral: string | null;
  initialScenes: SetModeScene[];
}) {
  const [scenes, setScenes] = useState(initialScenes);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [notesOpenIds, setNotesOpenIds] = useState<Set<string>>(
    () => new Set(initialScenes.flatMap((s) => s.shots.filter((sh) => sh.notasDirecao).map((sh) => sh.id)))
  );
  const [savingShotId, setSavingShotId] = useState<string | null>(null);
  const [savingSceneId, setSavingSceneId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Último valor salvo de notasDirecao por plano — usado pra decidir se um blur precisa de PATCH
  // e pra reverter o textarea se o PATCH falhar (o valor exibido é atualizado a cada tecla, sem
  // debounce, pra manter a UX simples; o servidor só é chamado no blur).
  const savedNotesRef = useRef<Record<string, string>>(
    Object.fromEntries(initialScenes.flatMap((s) => s.shots.map((sh) => [sh.id, sh.notasDirecao ?? ""])))
  );
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setSyncing(true);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => setSyncing(false), 2000);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  const elapsed = useMemo(() => formatElapsed(chamadaGeral, now), [chamadaGeral, now]);

  const totalShots = useMemo(() => scenes.reduce((sum, s) => sum + s.shots.length, 0), [scenes]);
  const filmedShots = useMemo(
    () => scenes.reduce((sum, s) => sum + s.shots.filter((sh) => sh.status === "FILMADO").length, 0),
    [scenes]
  );

  function toggleExpanded(sceneId: string) {
    setExpandedIds((cur) => {
      const next = new Set(cur);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  }

  function toggleNotesOpen(shotId: string) {
    setNotesOpenIds((cur) => {
      const next = new Set(cur);
      if (next.has(shotId)) next.delete(shotId);
      else next.add(shotId);
      return next;
    });
  }

  function updateShotLocal(sceneId: string, shotId: string, patch: Partial<SetModeShot>) {
    setScenes((cur) =>
      cur.map((sc) =>
        sc.sceneId === sceneId
          ? { ...sc, shots: sc.shots.map((sh) => (sh.id === shotId ? { ...sh, ...patch } : sh)) }
          : sc
      )
    );
  }

  async function setShotStatus(sceneId: string, shotId: string, status: ShotStatus) {
    const previous = scenes;
    updateShotLocal(sceneId, shotId, { status });
    setSavingShotId(shotId);

    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/shots/${shotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch (err) {
      console.error("Erro ao atualizar status do plano:", err);
      setScenes(previous);
      toast.error(offlineAwareErrorMessage());
    } finally {
      setSavingShotId(null);
    }
  }

  async function saveNotasDirecao(sceneId: string, shotId: string, value: string) {
    const trimmed = value.trim();
    const saved = savedNotesRef.current[shotId] ?? "";
    if (trimmed === saved.trim()) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/shots/${shotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notasDirecao: trimmed || null }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      savedNotesRef.current[shotId] = trimmed;
    } catch (err) {
      console.error("Erro ao salvar observação:", err);
      updateShotLocal(sceneId, shotId, { notasDirecao: saved });
      toast.error(offlineAwareErrorMessage());
    }
  }

  async function markSceneConcluida(sceneId: string) {
    const previous = scenes;
    setSavingSceneId(sceneId);
    setScenes((cur) => cur.map((sc) => (sc.sceneId === sceneId ? { ...sc, status: "CONCLUIDA" } : sc)));

    try {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/scenes/${sceneId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONCLUIDA" }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch (err) {
      console.error("Erro ao marcar cena como concluída:", err);
      setScenes(previous);
      toast.error(offlineAwareErrorMessage());
    } finally {
      setSavingSceneId(null);
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex shrink-0 flex-col gap-2 border-b bg-background p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold sm:text-lg">
            {projetoTitulo} · Diária {numeroDia}
          </p>
          <p className="text-sm text-muted-foreground">
            {new Date(data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
            {elapsed && <span> · {elapsed} desde a chamada geral</span>}
          </p>
          <p className="text-sm font-medium">
            Em andamento · {filmedShots}/{totalShots} planos filmados
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {syncing && (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-100 px-2.5 text-xs font-medium text-blue-900">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Sincronizando...
            </span>
          )}
          <span
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
              isOnline ? "bg-emerald-100 text-emerald-900" : "bg-destructive/15 text-destructive"
            )}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {isOnline ? "Online" : "Offline"}
          </span>
          <Button asChild variant="outline" className="h-11 gap-1.5 px-3 text-base">
            <Link href={`/projects/${projectId}/shootdays/${shootDayId}`}>
              <LogOut className="h-4 w-4" />
              Sair do modo set
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {scenes.length === 0 && (
            <p className="py-8 text-center text-base text-muted-foreground">
              Nenhuma cena agendada nesta diária.
            </p>
          )}

          {scenes.map((scene) => {
            const expanded = expandedIds.has(scene.sceneId);
            const allShotsDone =
              scene.shots.length > 0 && scene.shots.every((sh) => sh.status !== "PENDENTE");
            const showConcluirBanner = expanded && allShotsDone && scene.status !== "CONCLUIDA";

            return (
              <div key={scene.sceneId} className="overflow-hidden rounded-lg border bg-card">
                <button
                  type="button"
                  onClick={() => toggleExpanded(scene.sceneId)}
                  className="flex min-h-[64px] w-full items-center gap-3 p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold">Cena {scene.numero}</span>
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-semibold",
                          SCENE_STATUS_BADGE_CLASS[scene.status]
                        )}
                      >
                        {SCENE_STATUS_LABEL[scene.status]}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{scene.setLocacaoDisplay}</p>
                    {scene.sinopseAD && <p className="mt-0.5 truncate text-sm">{scene.sinopseAD}</p>}
                  </div>
                  {expanded ? (
                    <ChevronUp className="h-6 w-6 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-6 w-6 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {expanded && (
                  <div className="space-y-2 border-t p-3">
                    {showConcluirBanner && (
                      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                        <p className="mb-2 font-medium">
                          Todos os planos desta cena foram filmados ou cortados. Marcar cena como concluída?
                        </p>
                        <Button
                          size="sm"
                          className="h-11 px-4 text-base"
                          onClick={() => markSceneConcluida(scene.sceneId)}
                          disabled={savingSceneId === scene.sceneId}
                        >
                          {savingSceneId === scene.sceneId ? "Salvando..." : "Marcar cena como concluída"}
                        </Button>
                      </div>
                    )}

                    {scene.shots.length === 0 && (
                      <p className="py-2 text-sm text-muted-foreground">Nenhum plano cadastrado para esta cena.</p>
                    )}

                    {scene.shots.map((shot) => {
                      const notesOpen = notesOpenIds.has(shot.id);
                      const isCortado = shot.status === "DESCARTADO";
                      const isFilmado = shot.status === "FILMADO";

                      return (
                        <div
                          key={shot.id}
                          className={cn("rounded-md border p-3", isCortado && "bg-muted/40 opacity-70")}
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className={cn("text-base font-semibold", isCortado && "line-through")}>
                              P{shot.numero}
                            </span>
                            {shot.tamanho && (
                              <span className={cn("text-sm text-muted-foreground", isCortado && "line-through")}>
                                {shot.tamanho}
                              </span>
                            )}
                            {shot.movimento && (
                              <span className={cn("text-sm text-muted-foreground", isCortado && "line-through")}>
                                {shot.movimento}
                              </span>
                            )}
                            {isCortado && (
                              <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-xs font-semibold text-destructive">
                                Cortado
                              </span>
                            )}
                          </div>
                          <p className={cn("mt-1 text-sm", isCortado && "text-muted-foreground line-through")}>
                            {shot.descricao}
                          </p>
                          <p className={cn("mt-0.5 text-sm text-muted-foreground", isCortado && "line-through")}>
                            {shot.takesPrevistos}T × {shot.duracaoTakeMin}min
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              className={cn(
                                "h-11 min-w-[44px] flex-1 gap-1.5 text-base sm:flex-initial",
                                isFilmado
                                  ? "bg-emerald-600 text-white hover:bg-emerald-600/90"
                                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                              )}
                              onClick={() => setShotStatus(scene.sceneId, shot.id, "FILMADO")}
                              disabled={savingShotId === shot.id}
                            >
                              <CheckCircle2 className="h-4 w-4" />✓ Filmado
                            </Button>
                            <Button
                              type="button"
                              variant={isCortado ? "destructive" : "outline"}
                              className="h-11 min-w-[44px] flex-1 gap-1.5 text-base sm:flex-initial"
                              onClick={() => setShotStatus(scene.sceneId, shot.id, "DESCARTADO")}
                              disabled={savingShotId === shot.id}
                            >
                              ✗ Cortado
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-11 min-w-[44px] gap-1.5 px-2 text-base"
                              onClick={() => toggleNotesOpen(shot.id)}
                            >
                              <MessageSquarePlus className="h-4 w-4" />
                              Observação
                            </Button>
                          </div>

                          {notesOpen && (
                            <textarea
                              className="mt-2 w-full min-h-[44px] rounded-md border bg-background p-2 text-base"
                              placeholder="Observação de direção..."
                              value={shot.notasDirecao ?? ""}
                              onChange={(e) => updateShotLocal(scene.sceneId, shot.id, { notasDirecao: e.target.value })}
                              onBlur={(e) => saveNotasDirecao(scene.sceneId, shot.id, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
