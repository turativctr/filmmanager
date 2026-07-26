"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { useEffect, useState } from "react";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { TermTooltip } from "@/components/shared/term-tooltip";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { ShotInput } from "@/lib/validation/shot";
import type { ShotData } from "./shot-types";

function StatusBadge({ status }: { status: ShotData["status"] }) {
  if (status === "FILMADO") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-500 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
        <Check className="h-3 w-3" />
        Filmado
      </span>
    );
  }
  if (status === "DESCARTADO") {
    return (
      <Badge variant="outline" className="shrink-0 border-destructive/40 text-destructive">
        Descartado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0 text-muted-foreground">
      Pendente
    </Badge>
  );
}

export function SortableShotRow({
  shot,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  highlightContinuidade,
}: {
  shot: ShotData;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onUpdate: (id: string, data: Partial<ShotInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  highlightContinuidade: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: shot.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [takesDraft, setTakesDraft] = useState(shot.takesPrevistos.toString());
  const [duracaoDraft, setDuracaoDraft] = useState(shot.duracaoTakeMin.toString());
  const [setupDraft, setSetupDraft] = useState(shot.tempoSetupMin.toString());
  const [anguloDraft, setAnguloDraft] = useState(shot.angulo ?? "");
  const [movimentoDraft, setMovimentoDraft] = useState(shot.movimento ?? "");
  const [notasDirecaoDraft, setNotasDirecaoDraft] = useState(shot.notasDirecao ?? "");
  const [notasContinuidadeDraft, setNotasContinuidadeDraft] = useState(shot.notasContinuidade ?? "");

  // Ressincroniza os drafts sempre que o shot muda por fora (resposta do servidor após qualquer
  // mutação na cena) — sem isso um input local fica preso no valor digitado mesmo depois da lista
  // real ser atualizada (mesmo padrão de src/components/stripboard/strip-card.tsx).
  useEffect(() => {
    setTakesDraft(shot.takesPrevistos.toString());
    setDuracaoDraft(shot.duracaoTakeMin.toString());
    setSetupDraft(shot.tempoSetupMin.toString());
    setAnguloDraft(shot.angulo ?? "");
    setMovimentoDraft(shot.movimento ?? "");
    setNotasDirecaoDraft(shot.notasDirecao ?? "");
    setNotasContinuidadeDraft(shot.notasContinuidade ?? "");
  }, [shot]);

  function commitTakes() {
    const value = Number(takesDraft);
    if (!Number.isFinite(value) || value < 1) {
      setTakesDraft(shot.takesPrevistos.toString());
      return;
    }
    if (value === shot.takesPrevistos) return;
    void onUpdate(shot.id, { takesPrevistos: value });
  }

  function commitDuracao() {
    const value = Number(duracaoDraft);
    if (!Number.isFinite(value) || value < 0) {
      setDuracaoDraft(shot.duracaoTakeMin.toString());
      return;
    }
    if (value === shot.duracaoTakeMin) return;
    void onUpdate(shot.id, { duracaoTakeMin: value });
  }

  function commitSetup() {
    const value = Number(setupDraft);
    if (!Number.isFinite(value) || value < 0) {
      setSetupDraft(shot.tempoSetupMin.toString());
      return;
    }
    if (value === shot.tempoSetupMin) return;
    void onUpdate(shot.id, { tempoSetupMin: value });
  }

  function commitAngulo() {
    const value = anguloDraft.trim() === "" ? null : anguloDraft;
    if (value === shot.angulo) return;
    void onUpdate(shot.id, { angulo: value });
  }

  function commitMovimento() {
    const value = movimentoDraft.trim() === "" ? null : movimentoDraft;
    if (value === shot.movimento) return;
    void onUpdate(shot.id, { movimento: value });
  }

  function commitNotasDirecao() {
    const value = notasDirecaoDraft.trim() === "" ? null : notasDirecaoDraft;
    if (value === shot.notasDirecao) return;
    void onUpdate(shot.id, { notasDirecao: value });
  }

  function commitNotasContinuidade() {
    const value = notasContinuidadeDraft.trim() === "" ? null : notasContinuidadeDraft;
    if (value === shot.notasContinuidade) return;
    void onUpdate(shot.id, { notasContinuidade: value });
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-background">
      <div
        className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm"
        onClick={() => onToggleExpand(shot.id)}
      >
        <button
          type="button"
          className="shrink-0 touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
            <span className="w-16 shrink-0 truncate font-medium">{shot.numero}</span>
            <span className="w-28 shrink-0 truncate text-xs text-muted-foreground" title={shot.tamanho ?? undefined}>
              {shot.tamanho ?? "—"}
            </span>
            <span className="w-20 shrink-0 truncate text-xs text-muted-foreground" title={shot.lente ?? undefined}>
              {shot.lente ?? "—"}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                shot.status === "DESCARTADO" && "text-muted-foreground line-through"
              )}
              title={shot.descricao}
            >
              {shot.descricao}
            </span>
          </div>

          <div
            className="flex flex-wrap items-center gap-1 pl-8 text-xs text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-0.5">
              Takes
              <TermTooltip content="Número de takes previstos. Total = takes × duração + setup" />
            </span>
            <input
              type="number"
              min={1}
              className="h-6 w-12 rounded border bg-background px-1 py-0.5 text-xs"
              value={takesDraft}
              onChange={(e) => setTakesDraft(e.target.value)}
              onBlur={commitTakes}
            />
            <span>×</span>
            <input
              type="number"
              min={0}
              className="h-6 w-14 rounded border bg-background px-1 py-0.5 text-xs"
              value={duracaoDraft}
              onChange={(e) => setDuracaoDraft(e.target.value)}
              onBlur={commitDuracao}
            />
            <span>min +</span>
            <span className="flex items-center gap-0.5">
              Setup
              <TermTooltip content="Preparação específica deste plano (iluminação especial, rig, posicionamento). Diferente do reset entre planos." />
            </span>
            <input
              type="number"
              min={0}
              className="h-6 w-14 rounded border bg-background px-1 py-0.5 text-xs"
              value={setupDraft}
              onChange={(e) => setSetupDraft(e.target.value)}
              onBlur={commitSetup}
            />
            <span>min =</span>
            <span className="font-medium text-muted-foreground">{shot.tempoTotalMin}min</span>
          </div>
        </div>

        <StatusBadge status={shot.status} />
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </div>

      {isExpanded && (
        <div className="space-y-3 border-t px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Ângulo</label>
              <Input value={anguloDraft} onChange={(e) => setAnguloDraft(e.target.value)} onBlur={commitAngulo} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Movimento</label>
              <Input
                value={movimentoDraft}
                onChange={(e) => setMovimentoDraft(e.target.value)}
                onBlur={commitMovimento}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notas de direção</label>
            <Textarea
              rows={2}
              value={notasDirecaoDraft}
              onChange={(e) => setNotasDirecaoDraft(e.target.value)}
              onBlur={commitNotasDirecao}
            />
          </div>
          <div className="space-y-1">
            <label className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Notas de continuidade
              {highlightContinuidade && (
                <span className="font-medium text-amber-700">
                  — Reset de posição: verificar continuidade
                </span>
              )}
            </label>
            <Textarea
              rows={2}
              value={notasContinuidadeDraft}
              onChange={(e) => setNotasContinuidadeDraft(e.target.value)}
              onBlur={commitNotasContinuidade}
              className={cn(highlightContinuidade && "border-amber-400 bg-amber-100/60")}
            />
          </div>
          <div className="flex justify-end">
            <ConfirmDeleteDialog
              title={`Excluir plano ${shot.numero}?`}
              description="Essa ação remove o plano da decupagem. Não pode ser desfeita."
              onConfirm={() => onDelete(shot.id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
