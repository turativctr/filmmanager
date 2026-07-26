"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { computeShotsOrderTotalMin, detalhesPorUltimo, formatMinDelta, groupByLente, groupByTipo, resetarOrdem } from "./shot-ordering";

import type { ShotData } from "@/components/breakdown/shot-types";

type Candidate = {
  label: string;
  bySceneShots: Map<string, ShotData[]>;
  currentTotal: number;
  candidateTotal: number;
};

/** Botões de reorganização da diária inteira (cabeçalho do ShootDayColumn) — reorganizam
 *  Shot.ordem INDEPENDENTEMENTE DENTRO DE CADA CENA agendada no dia (nunca cruzam cenas: a
 *  constraint única (sceneId, ordem) já garante isso). O preview soma o delta de tempo entre
 *  todas as cenas afetadas antes de aplicar — ver PARTE 2 do pedido. */
export function DayGroupingButtons({
  projectId,
  sceneIds,
  onApplied,
}: {
  projectId: string;
  sceneIds: string[];
  onApplied: () => void;
}) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  async function fetchAllSceneShots(): Promise<Map<string, ShotData[]>> {
    const entries = await Promise.all(
      sceneIds.map(async (sceneId) => {
        const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/shots`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const shots: ShotData[] = await res.json();
        return [sceneId, shots] as const;
      })
    );
    return new Map(entries);
  }

  async function handlePreview(label: string, transform: (shots: ShotData[]) => ShotData[]) {
    if (sceneIds.length === 0) return;
    setLoadingLabel(label);
    setCandidate(null);
    try {
      const bySceneOriginal = await fetchAllSceneShots();
      let currentTotal = 0;
      let candidateTotal = 0;
      const bySceneShots = new Map<string, ShotData[]>();
      for (const [sceneId, shots] of bySceneOriginal) {
        currentTotal += computeShotsOrderTotalMin(shots);
        const next = transform(shots);
        candidateTotal += computeShotsOrderTotalMin(next);
        bySceneShots.set(sceneId, next);
      }
      setCandidate({ label, bySceneShots, currentTotal, candidateTotal });
    } catch (err) {
      console.error("Erro ao calcular reordenação da diária:", err);
      toast.error("Erro ao salvar — tente novamente");
    } finally {
      setLoadingLabel(null);
    }
  }

  async function applyCandidate() {
    if (!candidate) return;
    setApplying(true);
    try {
      const results = await Promise.all(
        Array.from(candidate.bySceneShots.entries()).map(([sceneId, shots]) =>
          fetch(`/api/projects/${projectId}/scenes/${sceneId}/shots/reorder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: shots.map((s) => s.id) }),
          })
        )
      );
      if (results.some((r) => !r.ok)) {
        toast.error("Erro ao salvar — tente novamente");
        return;
      }
      setCandidate(null);
      onApplied();
    } catch (err) {
      console.error("Erro de rede ao aplicar reordenação da diária:", err);
      toast.error("Erro ao salvar — tente novamente");
    } finally {
      setApplying(false);
    }
  }

  const busy = loadingLabel !== null || applying;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => handlePreview("Agrupado por lente", groupByLente)}
        >
          {loadingLabel === "Agrupado por lente" ? "Calculando..." : "Agrupar por lente"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => handlePreview("Agrupado por tipo", groupByTipo)}
        >
          {loadingLabel === "Agrupado por tipo" ? "Calculando..." : "Agrupar por tipo"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => handlePreview("Detalhes por último", detalhesPorUltimo)}
        >
          {loadingLabel === "Detalhes por último" ? "Calculando..." : "Detalhes por último"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => handlePreview("Ordem resetada", resetarOrdem)}
        >
          {loadingLabel === "Ordem resetada" ? "Calculando..." : "Resetar ordem"}
        </Button>
      </div>

      {candidate && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="mb-2">
            Ordem atual: {candidate.currentTotal}min → {candidate.label}: {candidate.candidateTotal}min (
            {formatMinDelta(candidate.candidateTotal - candidate.currentTotal)})
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
    </div>
  );
}
