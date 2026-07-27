"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pluralize } from "@/lib/pluralize";

export type MergeableLocacao = { id: string; nome: string; numCenas: number };

export function MergeLocacoesDialog({
  projectId,
  locacoes,
  open,
  onOpenChange,
  onMerged,
}: {
  projectId: string;
  locacoes: MergeableLocacao[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}) {
  const router = useRouter();
  const [survivorId, setSurvivorId] = useState<string | null>(locacoes[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!survivorId) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/locacoes/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        survivorId,
        absorbedIds: locacoes.map((l) => l.id).filter((id) => id !== survivorId),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível unificar as locações.");
      return;
    }

    onOpenChange(false);
    onMerged();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unificar {pluralize(locacoes.length, "locação", "locações")}</DialogTitle>
          <DialogDescription>
            Escolha qual registro sobrevive. As cenas dos outros são repontadas pra ele, os pontos de
            apoio são transferidos, e os registros absorvidos são removidos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {locacoes.map((l) => (
            <label
              key={l.id}
              className="flex items-center gap-3 rounded-md border p-3 text-sm hover:bg-accent"
            >
              <input
                type="radio"
                name="survivor"
                checked={survivorId === l.id}
                onChange={() => setSurvivorId(l.id)}
              />
              <span className="flex-1 font-medium">{l.nome}</span>
              <span className="text-xs text-muted-foreground">{pluralize(l.numCenas, "cena")}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-erro-fg">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !survivorId}>
            {loading ? "Unificando..." : "Unificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
