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

export function NewActualDialog({
  projectId,
  accounts,
}: {
  projectId: string;
  accounts: { id: string; codigo: string; nome: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/projects/${projectId}/budget/actuals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: form.get("accountId"),
        descricao: form.get("descricao"),
        valor: form.get("valor"),
        data: form.get("data"),
        notas: form.get("notas") || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível registrar o lançamento.");
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
          Lançamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Registrar um gasto real de produção.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="accountId">Conta</Label>
            <select
              id="accountId"
              name="accountId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Selecione
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo} — {a.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" name="descricao" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input id="valor" name="valor" type="number" step="any" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" name="notas" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Registrar lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
