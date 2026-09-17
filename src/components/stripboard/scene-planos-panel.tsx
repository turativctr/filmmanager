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
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { NewShotDialog } from "@/components/breakdown/new-shot-dialog";
import { SortableShotRow } from "@/components/breakdown/shot-row";
import { ResetDivider } from "@/components/shots/reset-divider";
import { SceneTempoAlvo } from "@/components/shots/scene-tempo-alvo";
import { Badge } from "@/components/ui/badge";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { HEAVY_RESETS, normalizeShotOrder } from "@/lib/shots-shared";

import type { ShotData } from "@/components/breakdown/shot-types";
import type { ShotInput } from "@/lib/validation/shot";

/** Detalhe entre parênteses pro ResetDivider quando o reset é TROCA_LENTE, ex.: "(24mm→50mm)". */
function lensChangeDetail(previous: ShotData, current: ShotData): string | undefined {
  if (current.tipoReset !== "TROCA_LENTE") return undefined;
  if (!previous.lente || !current.lente || previous.lente === current.lente) return undefined;
  return `(${previous.lente}→${current.lente})`;
}

/** Conteúdo expandido de uma tira de cena no Stripboard unificado — planos da cena (Shot.ordem),
 *  reordenáveis SÓ dentro desta cena (SortableContext independente, sem cruzar cenas — o plano
 *  pertence à cena de origem pra sempre, só a ordem NO DIA muda, e isso é feito pela visão "Ver
 *  todos os planos do dia", não aqui), e as notas operacionais do AD pra esta cena nesta diária. */
export function ScenePlanosPanel({
  projectId,
  sceneId,
  shootDayId,
  periodoColor,
  initialObservacoes,
  initialObservacoesAutoGeradas,
  fatorResetPercent = 100,
  initialDuracaoAlvoMin = null,
  tempoEstimadoMin = null,
}: {
  projectId: string;
  sceneId: string;
  /** Ausente quando a cena está no Boneyard — não há SceneShootDay pra guardar observações. */
  shootDayId?: string;
  periodoColor?: string;
  initialObservacoes?: string | null;
  initialObservacoesAutoGeradas?: boolean;
  /** Ritmo dos resets da diária (nível 3) — ausente no Boneyard, onde não há dia em escopo. */
  fatorResetPercent?: number;
  initialDuracaoAlvoMin?: number | null;
  tempoEstimadoMin?: number | null;
}) {
  const router = useRouter();
  const [shots, setShots] = useState<ShotData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [expandedShotId, setExpandedShotId] = useState<string | null>(null);

  // Mesmo motivo do resto do Stripboard: dnd-kit gera ids de acessibilidade que divergem entre
  // servidor e cliente na hidratação — só monta a árvore de DnD depois do primeiro efeito.
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/projects/${projectId}/scenes/${sceneId}/shots`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data: ShotData[]) => {
        if (!cancelled) setShots(data);
      })
      .catch((err) => {
        console.error("Erro ao carregar planos da cena:", err);
        if (!cancelled) toast.error("Erro ao carregar planos — tente novamente");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, sceneId]);

  const baseUrl = `/api/projects/${projectId}/scenes/${sceneId}/shots`;

  function toggleExpandShot(id: string) {
    setExpandedShotId((prev) => (prev === id ? null : id));
  }

  async function handleUpdate(shotId: string, data: Partial<ShotInput>) {
    try {
      const res = await fetch(`${baseUrl}/${shotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        // Regras de master/coverage voltam como 400 com o motivo — mostrar o motivo, não um genérico.
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.error === "string" ? data.error : "Erro ao salvar — tente novamente");
        return;
      }
      const updated: ShotData[] = await res.json();
      setShots(updated);
      // Mudar tempo, status ou hierarquia de plano mexe no Rod da cena — recarrega o cronograma.
      router.refresh();
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
      router.refresh();
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
      router.refresh();
    } catch (err) {
      console.error("Erro de rede ao reordenar planos:", err);
      toast.error("Erro ao salvar — tente novamente");
      setShots(previous);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !shots) return;

    const oldIndex = shots.findIndex((s) => s.id === active.id);
    const newIndex = shots.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = shots;
    // Mesmo reagrupamento do servidor: arrastar o pai leva os coverages; coverage não sai do grupo.
    const next = normalizeShotOrder(arrayMove(shots, oldIndex, newIndex));
    setShots(next);
    void persistOrder(next, previous);
  }

  return (
    <div className="space-y-3 border-t pt-2">
      {shots !== null && !loading && (
        <div className="pl-2">
          <SceneTempoAlvo
            projectId={projectId}
            sceneId={sceneId}
            shots={shots}
            initialDuracaoAlvoMin={initialDuracaoAlvoMin}
            tempoEstimadoMin={tempoEstimadoMin}
            onSaved={() => router.refresh()}
            mostrarRod={false}
          />
        </div>
      )}
      {shots === null || loading ? (
        <p className="pl-2 text-xs text-muted-foreground">Carregando planos...</p>
      ) : shots.length === 0 ? (
        <p className="pl-2 text-xs text-muted-foreground">Nenhum plano cadastrado ainda.</p>
      ) : !mounted ? (
        <p className="pl-2 text-xs text-muted-foreground">Carregando planos...</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={shots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1 pl-2">
              {shots.map((shot, index) => (
                <div key={shot.id}>
                  {index > 0 && (
                    <ResetDivider
                      tipoReset={shot.tipoReset}
                      tempoResetMin={shot.tempoResetMin}
                      tempoResetMinManual={shot.tempoResetMinManual}
                      fatorResetPercent={fatorResetPercent}
                      detail={lensChangeDetail(shots[index - 1], shot)}
                      onUpdateManual={(min) => handleUpdate(shot.id, { tempoResetMinManual: min })}
                    />
                  )}
                  <div
                    style={periodoColor ? { borderLeft: `4px solid ${periodoColor}` } : undefined}
                    className="rounded-md"
                  >
                    <SortableShotRow
                      shot={shot}
                      index={index}
                      isExpanded={expandedShotId === shot.id}
                      onToggleExpand={toggleExpandShot}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      highlightContinuidade={
                        HEAVY_RESETS.includes(shot.tipoReset) && Boolean(shot.notasContinuidade?.trim())
                      }
                      sceneShots={shots}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="pl-2">
        <NewShotDialog
          projectId={projectId}
          sceneId={sceneId}
          onCreated={(created) => {
            setShots(created);
            router.refresh();
          }}
        />
      </div>

      {shootDayId && (
        <ObservacoesField
          projectId={projectId}
          sceneId={sceneId}
          shootDayId={shootDayId}
          initialObservacoes={initialObservacoes}
          initialObservacoesAutoGeradas={initialObservacoesAutoGeradas}
        />
      )}
    </div>
  );
}

function ObservacoesField({
  projectId,
  sceneId,
  shootDayId,
  initialObservacoes,
  initialObservacoesAutoGeradas,
}: {
  projectId: string;
  sceneId: string;
  shootDayId: string;
  initialObservacoes?: string | null;
  initialObservacoesAutoGeradas?: boolean;
}) {
  const [draft, setDraft] = useState(initialObservacoes ?? "");
  const [autoGerada, setAutoGerada] = useState(Boolean(initialObservacoesAutoGeradas));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ressincroniza quando os dados iniciais mudam por fora (ex.: refresh do servidor após outra ação).
  useEffect(() => {
    setDraft(initialObservacoes ?? "");
    setAutoGerada(Boolean(initialObservacoesAutoGeradas));
  }, [initialObservacoes, initialObservacoesAutoGeradas]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function save(value: string) {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/shoot-days/${shootDayId}/scenes/${sceneId}/observacoes`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ observacoes: value.trim() === "" ? null : value }),
        }
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const updated: { observacoes: string | null; observacoesAutoGeradas: boolean } = await res.json();
      setAutoGerada(updated.observacoesAutoGeradas);
    } catch (err) {
      console.error("Erro ao salvar observações do AD:", err);
      toast.error("Erro ao salvar — tente novamente");
    }
  }

  function handleChange(value: string) {
    setDraft(value);
    // Otimista: o badge some assim que o AD começa a digitar, sem esperar o PATCH debounced voltar.
    setAutoGerada(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(value), 800);
  }

  return (
    <div className="space-y-1 pl-2">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        Observações do AD para esta diária
        {autoGerada && (
          <Badge variant="outline" className="text-[10px] font-normal">
            Gerado automaticamente
          </Badge>
        )}
      </label>
      <AutoGrowTextarea
        rows={2}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Notas operacionais, alertas, lembretes..."
        className="text-sm"
      />
    </div>
  );
}
