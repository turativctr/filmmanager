"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

import type { ShotData } from "./shot-types";

export function NewShotDialog({
  projectId,
  sceneId,
  onCreated,
}: {
  projectId: string;
  sceneId: string;
  onCreated: (shots: ShotData[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      numero: data.get("numero"),
      descricao: data.get("descricao"),
      tamanho: data.get("tamanho") || undefined,
      lente: data.get("lente") || undefined,
      angulo: data.get("angulo") || undefined,
      movimento: data.get("movimento") || undefined,
      takesPrevistos: data.get("takesPrevistos") || undefined,
      duracaoTakeMin: data.get("duracaoTakeMin") || undefined,
      tempoSetupMin: data.get("tempoSetupMin") || undefined,
    };

    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/shots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error("Erro ao salvar — tente novamente");
        return;
      }

      const created: ShotData[] = await res.json();
      onCreated(created);
      setOpen(false);
      form.reset();
    } catch (err) {
      console.error("Erro de rede ao criar plano:", err);
      toast.error("Erro ao salvar — tente novamente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Plano
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo plano</DialogTitle>
          <DialogDescription>
            Preencha os dados do plano — reset e tempo de reset são calculados automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="numero">Número</Label>
              <Input id="numero" name="numero" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tamanho">Tamanho</Label>
              <Input id="tamanho" name="tamanho" placeholder="ex.: Close, Plano geral" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" name="descricao" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="lente">Lente</Label>
              <Input id="lente" name="lente" placeholder="ex.: 50mm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="angulo">Ângulo</Label>
              <Input id="angulo" name="angulo" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="movimento">Movimento</Label>
            <Input id="movimento" name="movimento" placeholder="ex.: Estático, Travelling" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="takesPrevistos">Takes previstos</Label>
              <Input id="takesPrevistos" name="takesPrevistos" type="number" min={1} defaultValue={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duracaoTakeMin">Duração/take (min)</Label>
              <Input id="duracaoTakeMin" name="duracaoTakeMin" type="number" min={0} defaultValue={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tempoSetupMin">Setup (min)</Label>
              <Input id="tempoSetupMin" name="tempoSetupMin" type="number" min={0} defaultValue={0} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar plano"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
