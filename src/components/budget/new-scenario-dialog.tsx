"use client";

import { Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { GlobalData } from "./types";

export function NewScenarioDialog({ projectId, globals }: { projectId: string; globals: GlobalData[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const overrides = globals
      .map((g) => {
        const raw = form.get(`override:${g.chave}`);
        if (raw === null || raw === "") return null;
        const valor = Number(raw);
        if (!Number.isFinite(valor) || valor === g.valor) return null;
        return { chave: g.chave, valor };
      })
      .filter((o): o is { chave: string; valor: number } => o !== null);

    const res = await fetch(`/api/projects/${projectId}/budget/scenarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.get("nome"),
        notas: form.get("notas") || undefined,
        overrides,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível criar o cenário.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Novo cenário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cenário</DialogTitle>
          <DialogDescription>
            Herda todos os LineItems do orçamento; só os Globals abaixo diferem neste cenário.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" placeholder="Cenário B — 7 dias" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notas">Descrição</Label>
            <Textarea id="notas" name="notas" rows={2} placeholder="Extensão do set em 2 dias" />
          </div>
          {globals.length > 0 && (
            <div className="space-y-1.5">
              <Label>Sobrescrever Globals (deixe em branco para manter o valor atual)</Label>
              <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
                {globals.map((g) => (
                  <div key={g.id} className="space-y-1">
                    <Label htmlFor={`override:${g.chave}`} className="text-xs text-muted-foreground">
                      {g.chave} (atual: {g.valor})
                    </Label>
                    <Input id={`override:${g.chave}`} name={`override:${g.chave}`} type="number" step="any" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar cenário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
