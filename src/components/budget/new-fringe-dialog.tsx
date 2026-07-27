"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

import type { AccountGroupData } from "./types";

const TIPOS = ["INSS", "FGTS", "ISS", "OUTRO"] as const;

export function NewFringeDialog({
  projectId,
  accountGroups,
}: {
  projectId: string;
  accountGroups: AccountGroupData[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const teto = form.get("teto");
    const res = await fetch(`/api/projects/${projectId}/budget/fringes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.get("nome"),
        percentual: form.get("percentual"),
        teto: teto ? teto : undefined,
        tipo: form.get("tipo"),
        aplicaEm: [...selected],
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível criar o fringe.");
      return;
    }

    setOpen(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Encargo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Encargo</DialogTitle>
          <DialogDescription>
            Encargo percentual aplicado sobre a mão de obra sujeita a encargos (fringeable).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" name="nome" placeholder="INSS" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo</Label>
              <select
                id="tipo"
                name="tipo"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="percentual">Percentual (%)</Label>
              <Input id="percentual" name="percentual" type="number" step="any" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teto">Teto de base (opcional)</Label>
              <Input id="teto" name="teto" type="number" step="any" placeholder="7786" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Aplicado em</Label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
              {accountGroups.map((group) => (
                <div key={group.id}>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={selected.has(group.id)} onCheckedChange={() => toggle(group.id)} />
                    {group.codigo} — {group.nome}
                  </label>
                  <div className="ml-6 space-y-1 pt-1">
                    {group.accounts.map((account) => (
                      <label key={account.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox checked={selected.has(account.id)} onCheckedChange={() => toggle(account.id)} />
                        {account.codigo} — {account.nome}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar encargo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
