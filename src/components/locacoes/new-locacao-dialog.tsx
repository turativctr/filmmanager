"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { showAddressDuplicateWarning } from "@/components/locacoes/address-duplicate-toast";
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

export function NewLocacaoDialog({
  projectId,
  trigger,
  onCreated,
}: {
  projectId: string;
  trigger?: ReactNode;
  /** Chamado com o id da locação recém-criada — usado pelo fluxo de "Separar" pra apontar as cenas
   *  selecionadas pra ela assim que é criada, em vez de só atualizar a lista. */
  onCreated?: (locacaoId: string) => void;
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
    const payload = {
      nome: form.get("nome"),
      endereco: form.get("endereco") || undefined,
    };

    const res = await fetch(`/api/projects/${projectId}/locacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível criar a locação.");
      return;
    }

    const data = await res.json();
    setOpen(false);
    router.refresh();
    onCreated?.(data.locacao.id);
    showAddressDuplicateWarning(projectId, data.locacao.id, data.possibleDuplicates, () => router.refresh());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova locação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova locação</DialogTitle>
          <DialogDescription>
            O lugar real onde se filma — diferente do set (o lugar da ficção, vem do roteiro).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" name="endereco" placeholder="Pode preencher depois" />
          </div>
          {error && <p className="text-sm text-erro-fg">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar locação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
