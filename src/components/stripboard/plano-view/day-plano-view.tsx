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
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { ShotData } from "@/components/breakdown/shot-types";
import { Button } from "@/components/ui/button";
import { getSceneColor } from "@/lib/scene-color";

import {
  computeOrderTotalMin,
  countLensChanges,
  formatMinDelta,
  groupByCena,
  groupByLente,
  groupByTipo,
  minLensChanges,
  moveDetalhesToEnd,
} from "./grouping";
import { PlanoStrip, ResetDivider } from "./plano-strip";
import type { PlanoScheduleEntry } from "./types";

type Candidate = { label: string; order: PlanoScheduleEntry[] };

/** Plano de uma cena agendada neste dia que ainda não tem ShotSchedule — carrega o sceneId junto
 *  (não vem no shape de ShotData) pra poder exibir "C{numero da cena}·P{numero do plano}" na
 *  seção "Planos não agendados". */
type UnscheduledShot = ShotData & { sceneId: string };

function lensDetail(prevLente: string | null, curLente: string | null): string {
  if (!prevLente || !curLente) return "";
  return `(${prevLente}→${curLente})`;
}

export function DayPlanoView({
  projectId,
  shootDayId,
  scenes,
  fatorResetPercent = 100,
}: {
  projectId: string;
  shootDayId: string;
  /** Cenas agendadas neste dia no Stripboard (bloco manhã, depois tarde), com número pra exibição —
   *  usada tanto pra descobrir quais planos pertencem a este dia (Correção 2) quanto pelo botão
   *  "Agrupar por cena". */
  scenes: { id: string; numero: string }[];
  /** Ritmo dos resets desta diária (nível 3 de "tempos de reset configuráveis") — 100 = sem ajuste. */
  fatorResetPercent?: number;
}) {
  const sceneOrder = useMemo(() => scenes.map((s) => s.id), [scenes]);
  const sceneNumeroById = useMemo(() => new Map(scenes.map((s) => [s.id, s.numero])), [scenes]);

  const [entries, setEntries] = useState<PlanoScheduleEntry[] | null>(null);
  const [unscheduled, setUnscheduled] = useState<UnscheduledShot[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [savingBlocoId, setSavingBlocoId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applying, setApplying] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mesmo motivo do StripboardBoard: dnd-kit gera ids de acessibilidade que divergem entre
  // servidor e cliente — só monta a árvore com DndContext depois do primeiro efeito.
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Correção 2: busca separadamente (a) os planos já agendados neste dia (ShotSchedule) e (b)
  // TODOS os planos das cenas agendadas neste dia (via SceneShootDay → Shot), pra distinguir os
  // três casos possíveis:
  //   - tem ShotSchedule pra este dia          → lista ordenada principal (entries)
  //   - cena agendada neste dia, sem ShotSchedule → seção "Planos não agendados" (unscheduled)
  //   - cena não agendada neste dia               → nunca é buscado (nem entra em `scenes`)
  // Não há mais auto-seed automático: adicionar um plano não agendado à ordem do dia agora é uma
  // ação manual do AD (botão "Adicionar" por plano, ou "Adicionar todos"), já que a seção deixa o
  // estado "ainda não agendado" visível — auto-atribuir tudo silenciosamente esvaziaria a seção.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [scheduleRes, perSceneShots] = await Promise.all([
          fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/shot-schedule`),
          Promise.all(
            sceneOrder.map(async (sceneId) => {
              const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/shots`);
              if (!res.ok) throw new Error(`status ${res.status}`);
              const shots: ShotData[] = await res.json();
              return shots.map((shot): UnscheduledShot => ({ ...shot, sceneId }));
            })
          ),
        ]);
        if (!scheduleRes.ok) throw new Error(`status ${scheduleRes.status}`);
        const scheduleData: PlanoScheduleEntry[] = await scheduleRes.json();
        if (cancelled) return;

        const scheduledShotIds = new Set(scheduleData.map((e) => e.shotId));
        const allSceneShots = perSceneShots.flat();

        setEntries(scheduleData);
        setUnscheduled(allSceneShots.filter((shot) => !scheduledShotIds.has(shot.id)));
      } catch (err) {
        console.error("Erro ao carregar planos do dia:", err);
        if (!cancelled) toast.error("Erro ao carregar planos — tente novamente");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // sceneOrder só é usado no mount (esta view remonta do zero toda vez que é aberta) — não deve
    // re-disparar o efeito por causa da identidade do array mudar entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, shootDayId]);

  async function persistOrder(next: PlanoScheduleEntry[], previous: PlanoScheduleEntry[]) {
    try {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/shot-schedule/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((e) => e.id) }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const updated: PlanoScheduleEntry[] = await res.json();
      setEntries(updated);
    } catch (err) {
      console.error("Erro ao reordenar planos:", err);
      toast.error("Erro ao salvar — tente novamente");
      setEntries(previous);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !entries) return;
    const oldIndex = entries.findIndex((e) => e.id === active.id);
    const newIndex = entries.findIndex((e) => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = entries;
    const next = arrayMove(entries, oldIndex, newIndex);
    setEntries(next);
    setCandidate(null);
    persistOrder(next, previous);
  }

  async function handleBlocoChange(scheduleId: string, bloco: "MANHA" | "TARDE" | null) {
    if (!entries) return;
    const previous = entries;
    setSavingBlocoId(scheduleId);
    setEntries(entries.map((e) => (e.id === scheduleId ? { ...e, bloco } : e)));

    try {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/shot-schedule/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloco }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const updated: PlanoScheduleEntry = await res.json();
      setEntries((prev) => prev?.map((e) => (e.id === scheduleId ? updated : e)) ?? prev);
    } catch (err) {
      console.error("Erro ao salvar bloco do plano:", err);
      toast.error("Erro ao salvar — tente novamente");
      setEntries(previous);
    } finally {
      setSavingBlocoId(null);
    }
  }

  async function handleResetManualChange(scheduleId: string, tempoResetMinManual: number | null) {
    if (!entries) return;
    const previous = entries;
    setEntries(entries.map((e) => (e.id === scheduleId ? { ...e, tempoResetMinManual } : e)));

    try {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/shot-schedule/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempoResetMinManual }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const updated: PlanoScheduleEntry = await res.json();
      setEntries((prev) => prev?.map((e) => (e.id === scheduleId ? updated : e)) ?? prev);
    } catch (err) {
      console.error("Erro ao salvar ajuste de reset:", err);
      toast.error("Erro ao salvar — tente novamente");
      setEntries(previous);
    }
  }

  async function applyCandidate() {
    if (!candidate || !entries) return;
    setApplying(true);
    const previous = entries;
    const next = candidate.order;
    setEntries(next);
    setCandidate(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/shot-schedule/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((e) => e.id) }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const updated: PlanoScheduleEntry[] = await res.json();
      setEntries(updated);
    } catch (err) {
      console.error("Erro ao aplicar reordenação:", err);
      toast.error("Erro ao salvar — tente novamente");
      setEntries(previous);
    } finally {
      setApplying(false);
    }
  }

  /** Ação manual/opt-in (Correção 2) — atribui UM plano não agendado à ordem do dia (vai pro final). */
  async function addToSchedule(shot: UnscheduledShot) {
    setAddingId(shot.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/shot-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shotId: shot.id }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const updated: PlanoScheduleEntry[] = await res.json();
      setEntries(updated);
      setUnscheduled((prev) => prev?.filter((s) => s.id !== shot.id) ?? prev);
    } catch (err) {
      console.error("Erro ao adicionar plano à ordem do dia:", err);
      toast.error("Erro ao salvar — tente novamente");
    } finally {
      setAddingId(null);
    }
  }

  /** "Adicionar todos" — mesma ressalva do antigo seedSchedule: sequencial de propósito, não
   *  Promise.all, porque o endpoint calcula `ordem` via MAX(ordem)+1 a cada chamada e POSTs
   *  concorrentes colidiriam na constraint única (shootDayId, ordem). */
  async function addAllToSchedule() {
    if (!unscheduled || unscheduled.length === 0) return;
    setAddingAll(true);
    const toAdd = unscheduled;
    try {
      let lastResult: PlanoScheduleEntry[] = entries ?? [];
      for (const shot of toAdd) {
        const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/shot-schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shotId: shot.id }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        lastResult = await res.json();
      }
      setEntries(lastResult);
      setUnscheduled([]);
    } catch (err) {
      console.error("Erro ao adicionar planos à ordem do dia:", err);
      toast.error("Erro ao salvar — tente novamente");
      // Reflete o estado real do servidor mesmo após falha parcial (parte dos planos pode ter
      // sido atribuída antes de falhar) — evita a UI ficar com uma seção "não agendados" errada.
      try {
        const scheduleRes = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/shot-schedule`);
        if (scheduleRes.ok) {
          const scheduleData: PlanoScheduleEntry[] = await scheduleRes.json();
          const scheduledShotIds = new Set(scheduleData.map((e) => e.shotId));
          setEntries(scheduleData);
          setUnscheduled(toAdd.filter((s) => !scheduledShotIds.has(s.id)));
        }
      } catch {
        // mantém o estado local otimista se nem a releitura funcionar
      }
    } finally {
      setAddingAll(false);
    }
  }

  const currentTotal = useMemo(() => (entries ? computeOrderTotalMin(entries) : 0), [entries]);
  const lensChanges = useMemo(() => (entries ? countLensChanges(entries) : 0), [entries]);
  const minChanges = useMemo(() => (entries ? minLensChanges(entries) : 0), [entries]);
  const unnecessaryLensChanges = Math.max(0, lensChanges - minChanges);

  if (!mounted || loading) {
    return <p className="text-sm text-muted-foreground">Carregando planos...</p>;
  }

  const hasEntries = Boolean(entries && entries.length > 0);
  const hasUnscheduled = Boolean(unscheduled && unscheduled.length > 0);

  if (!hasEntries && !hasUnscheduled) {
    return <p className="text-sm text-muted-foreground">Nenhum plano cadastrado para as cenas deste dia.</p>;
  }

  return (
    <div className="space-y-3">
      {hasEntries && entries && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setCandidate({ label: "Agrupado por lente", order: groupByLente(entries) })}>
              Agrupar por lente
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCandidate({ label: "Agrupado por tipo", order: groupByTipo(entries) })}>
              Agrupar por tipo
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCandidate({ label: "Agrupado por cena", order: groupByCena(entries, sceneOrder) })}>
              Agrupar por cena
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCandidate({ label: "Detalhes por último", order: moveDetalhesToEnd(entries) })}>
              Detalhes por último
            </Button>
          </div>

          {unnecessaryLensChanges > 0 && !candidate && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {unnecessaryLensChanges} troca{unnecessaryLensChanges === 1 ? "" : "s"} de lente desnecessária
              {unnecessaryLensChanges === 1 ? "" : "s"} —{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => setCandidate({ label: "Agrupado por lente", order: groupByLente(entries) })}
              >
                sugerir reordenação?
              </button>
            </div>
          )}

          {candidate && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="mb-2">
                Ordem atual: {currentTotal}min → {candidate.label}: {computeOrderTotalMin(candidate.order)}min (
                {formatMinDelta(computeOrderTotalMin(candidate.order) - currentTotal)})
              </p>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={applyCandidate} disabled={applying}>
                  {applying ? "Aplicando..." : "Aplicar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCandidate(null)} disabled={applying}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {entries.map((entry, index) => (
                  <div key={entry.id}>
                    {index > 0 && (
                      <ResetDivider
                        tipoReset={entry.tipoReset}
                        tempoResetMin={entry.tempoResetMin}
                        tempoResetMinManual={entry.tempoResetMinManual}
                        fatorResetPercent={fatorResetPercent}
                        detail={
                          entry.tipoReset === "TROCA_LENTE"
                            ? lensDetail(entries[index - 1].shot.lente, entry.shot.lente)
                            : undefined
                        }
                        onUpdateManual={(min) => handleResetManualChange(entry.id, min)}
                      />
                    )}
                    <PlanoStrip
                      entry={entry}
                      colorHex={getSceneColor(entry.shot.sceneId)}
                      onBlocoChange={handleBlocoChange}
                      savingBloco={savingBlocoId === entry.id}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {hasUnscheduled && unscheduled && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Planos não agendados ({unscheduled.length})</h4>
            <Button size="sm" variant="outline" onClick={addAllToSchedule} disabled={addingAll}>
              {addingAll ? "Adicionando..." : "Adicionar todos à ordem do dia"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Planos de cenas agendadas neste dia que ainda não entraram na ordem de filmagem abaixo.
          </p>
          <div className="space-y-1">
            {unscheduled.map((shot) => (
              <div
                key={shot.id}
                className="flex items-center gap-3 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm"
              >
                <span className="w-16 shrink-0 font-mono text-xs font-semibold" title="Cena · Plano">
                  C{sceneNumeroById.get(shot.sceneId) ?? "?"}·P{shot.numero}
                </span>
                <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={shot.tamanho ?? undefined}>
                  {shot.tamanho ?? "—"}
                </span>
                <span className="w-20 shrink-0 truncate text-xs text-muted-foreground" title={shot.lente ?? undefined}>
                  {shot.lente ?? "—"}
                </span>
                <span className="flex-1 truncate text-muted-foreground" title={shot.descricao}>
                  {shot.descricao}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addToSchedule(shot)}
                  disabled={addingId === shot.id || addingAll}
                >
                  {addingId === shot.id ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
