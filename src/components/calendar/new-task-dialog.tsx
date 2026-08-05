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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Controlado de fora, mesmo padrão de NewEventDialog — gatilho é o menu "Novo evento / Nova
 *  tarefa" no cabeçalho do Calendário. `responsavelOptions` autocompleta a partir dos valores já
 *  usados no projeto, sem restringir a eles (texto livre — departamento ou nome). */
export function NewTaskDialog({
  projectId,
  responsavelOptions,
  defaultDate,
  open,
  onOpenChange,
}: {
  projectId: string;
  responsavelOptions: string[];
  defaultDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      titulo: form.get("titulo"),
      descricao: form.get("descricao") || undefined,
      prazo: form.get("prazo"),
      responsavel: form.get("responsavel") || undefined,
    };

    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível criar a tarefa.");
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>
            Um prazo de pré-produção — algo a cumprir, não um evento que ocupa tempo num dia.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" name="titulo" placeholder="ex.: Entrega da decupagem" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prazo">Prazo</Label>
              <Input id="prazo" name="prazo" type="date" defaultValue={defaultDate} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="responsavel">Responsável (opcional)</Label>
            <Input
              id="responsavel"
              name="responsavel"
              list="responsavel-options"
              placeholder="Departamento ou nome"
            />
            <datalist id="responsavel-options">
              {responsavelOptions.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea id="descricao" name="descricao" rows={2} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
