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
import { AlertTriangle, ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { NewShotDialog } from "@/components/breakdown/new-shot-dialog";
import { SortableShotRow } from "@/components/breakdown/shot-row";
import { ResetDivider } from "@/components/shots/reset-divider";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  computeSceneShotTotals,
  HEAVY_RESETS,
  isDetalheOuInsert,
  normalize,
  recomputeResetsForOrderedShots,
} from "@/lib/shots";
import { cn } from "@/lib/utils";

import type { ShotInput } from "@/lib/validation/shot";
import type { ShotData } from "./shot-types";

/** Agrupa por lente (preservando ordem relativa original dentro do grupo e entre grupos, pela
 *  primeira aparição), com planos Detalhe/Insert sempre forçados pro final — PARTE 6. */
function computeSuggestedOrder(shots: ShotData[]): ShotData[] {
  const detalheInsert = shots.filter((s) => isDetalheOuInsert(s.tamanho));
  const rest = shots.filter((s) => !isDetalheOuInsert(s.tamanho));

  const groups = new Map<string, ShotData[]>();
  const groupOrder: string[] = [];
  for (const shot of rest) {
    const key = normalize(shot.lente);
    if (!groups.has(key)) {
      groups.set(key, []);
      groupOrder.push(key);
    }
    groups.get(key)!.push(shot);
  }

  return [...groupOrder.flatMap((key) => groups.get(key)!), ...detalheInsert];
}

/** Total (planos + resets) de uma ordem hipotética de planos, recalculando os resets do zero —
 *  usado pra comparar "ordem atual" vs. "ordem sugerida" sem bater na API. */
function totalForOrder(order: ShotData[]): number {
  const resets = recomputeResetsForOrderedShots(order);
  const enriched = order.map((shot) => ({
    tempoTotalMin: shot.tempoTotalMin,
    tempoResetMin: resets.get(shot.id)?.tempoResetMin ?? 0,
    takesPrevistos: shot.takesPrevistos,
    status: shot.status,
  }));
  return computeSceneShotTotals(enriched).totalMin;
}

function countLensChanges(order: ShotData[]): number {
  let changes = 0;
  for (let i = 1; i < order.length; i++) {
    const a = normalize(order[i - 1].lente);
    const b = normalize(order[i].lente);
    if (a !== b && (a !== "" || b !== "")) changes++;
  }
  return changes;
}

/** Mínimo de trocas de lente possível se os planos fossem agrupados de forma ótima só por lente
 *  (ignora a regra de Detalhe/Insert por último) — heurística simples, só pra sinalizar. */
function minPossibleLensChanges(shots: ShotData[]): number {
  const distinct = new Set(shots.map((s) => normalize(s.lente)));
  return Math.max(0, distinct.size - 1);
}

/** Detalhe entre parênteses pro ResetDivider quando o reset é TROCA_LENTE, ex.: "(24mm→50mm)". */
function lensChangeDetail(previous: ShotData, current: ShotData): string | undefined {
  if (current.tipoReset !== "TROCA_LENTE") return undefined;
  if (!previous.lente || !current.lente || previous.lente === current.lente) return undefined;
  return `(${previous.lente}→${current.lente})`;
}

export function ShotListPanel({
  projectId,
  sceneId,
  initialShots,
}: {
  projectId: string;
  sceneId: string;
  initialShots: ShotData[];
}) {
  const [open, setOpen] = useState(true);
  const [shots, setShots] = useState<ShotData[]>(initialShots);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [suggestion, setSuggestion] = useState<{ order: ShotData[]; suggestedTotal: number } | null>(null);
  const [noImprovement, setNoImprovement] = useState(false);

  // dnd-kit gera ids de acessibilidade que divergem entre servidor e cliente na hidratação —
  // renderizar a árvore de DnD só depois do mount evita o mismatch (mesmo padrão do Stripboard).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Qualquer mudança real na lista invalida a sugestão computada anteriormente.
  useEffect(() => {
    setSuggestion(null);
    setNoImprovement(false);
  }, [shots]);

  const baseUrl = `/api/projects/${projectId}/scenes/${sceneId}/shots`;

  const totals = useMemo(() => computeSceneShotTotals(shots), [shots]);
  const unnecessaryLensChanges = useMemo(() => {
    const current = countLensChanges(shots);
    const min = minPossibleLensChanges(shots);
    return Math.max(0, current - min);
  }, [shots]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleUpdate(shotId: string, data: Partial<ShotInput>) {
    try {
      const res = await fetch(`${baseUrl}/${shotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        toast.error("Erro ao salvar — tente novamente");
        return;
      }
      const updated: ShotData[] = await res.json();
      setShots(updated);
    } catch (err) {
      console.error("Erro de rede ao salvar plano:", err);
      toast.error("Erro ao salvar — tente novamente");
    }
  }

  async function handleDelete(shotId: string) {
    try {
      const res = await fetch(`${baseUrl}/${shotId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Erro ao salvar — tente novamente");
        return;
      }
      const updated: ShotData[] = await res.json();
      setShots(updated);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(shotId);
        return next;
      });
    } catch (err) {
      console.error("Erro de rede ao excluir plano:", err);
      toast.error("Erro ao salvar — tente novamente");
    }
  }

  async function persistOrder(order: ShotData[], previous: ShotData[]) {
    try {
      const res = await fetch(`${baseUrl}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: order.map((s) => s.id) }),
      });
      if (!res.ok) {
        toast.error("Erro ao salvar — tente novamente");
        setShots(previous);
        return;
      }
      const updated: ShotData[] = await res.json();
      setShots(updated);
    } catch (err) {
      console.error("Erro de rede ao reordenar planos:", err);
      toast.error("Erro ao salvar — tente novamente");
      setShots(previous);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = shots.findIndex((s) => s.id === active.id);
    const newIndex = shots.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = shots;
    const next = arrayMove(shots, oldIndex, newIndex);
    setShots(next);
    void persistOrder(next, previous);
  }

  function handleSuggest() {
    const order = computeSuggestedOrder(shots);
    const suggestedTotal = totalForOrder(order);
    if (suggestedTotal >= totals.totalMin) {
      setSuggestion(null);
      setNoImprovement(true);
      return;
    }
    setNoImprovement(false);
    setSuggestion({ order, suggestedTotal });
  }

  async function handleUseSuggestion() {
    if (!suggestion) return;
    const previous = shots;
    const next = suggestion.order;
    setShots(next);
    setSuggestion(null);
    await persistOrder(next, previous);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <CollapsibleTrigger className="flex items-center gap-1.5 text-base font-semibold">
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          Planos ({totals.count})
        </CollapsibleTrigger>
        {open && shots.length > 1 && (
          <Button type="button" variant="outline" size="sm" onClick={handleSuggest}>
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Sugerir ordem otimizada
          </Button>
        )}
      </div>

      <CollapsibleContent className="space-y-3 px-4 pb-4">
        <p className="text-sm text-muted-foreground">
          {totals.planosMin}min de planos + {totals.resetsMin}min de resets = {totals.totalMin}min total ·{" "}
          {totals.takesTotal} take{totals.takesTotal === 1 ? "" : "s"}
        </p>

        {unnecessaryLensChanges > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {unnecessaryLensChanges} troca{unnecessaryLensChanges > 1 ? "s" : ""} de lente desnecessária
              {unnecessaryLensChanges > 1 ? "s" : ""} — sugerir reordenação?
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={handleSuggest}>
              Ver sugestão
            </Button>
          </div>
        )}

        {noImprovement && (
          <p className="text-xs text-muted-foreground">A ordem atual já é a mais eficiente possível.</p>
        )}

        {suggestion && (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>
              Ordem atual: {totals.totalMin}min → Sugerida: {suggestion.suggestedTotal}min (
              -{totals.totalMin - suggestion.suggestedTotal}min)
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleUseSuggestion}>
                Usar esta ordem
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSuggestion(null)}>
                Manter ordem atual
              </Button>
            </div>
          </div>
        )}

        {shots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum plano cadastrado ainda.</p>
        ) : !mounted ? (
          <p className="text-sm text-muted-foreground">Carregando planos...</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={shots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {shots.map((shot, index) => (
                  <div key={shot.id}>
                    {index > 0 && (
                      <ResetDivider
                        tipoReset={shot.tipoReset}
                        tempoResetMin={shot.tempoResetMin}
                        detail={lensChangeDetail(shots[index - 1], shot)}
                      />
                    )}
                    <SortableShotRow
                      shot={shot}
                      index={index}
                      isExpanded={expanded.has(shot.id)}
                      onToggleExpand={toggleExpand}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      highlightContinuidade={
                        HEAVY_RESETS.includes(shot.tipoReset) && Boolean(shot.notasContinuidade?.trim())
                      }
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <NewShotDialog projectId={projectId} sceneId={sceneId} onCreated={setShots} />
      </CollapsibleContent>
    </Collapsible>
  );
}
