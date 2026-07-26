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

export function NewShootDayDialog({
  projectId,
  nextNumeroDia,
}: {
  projectId: string;
  nextNumeroDia: number;
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
      numeroDia: form.get("numeroDia"),
      data: form.get("data"),
      chamadaGeral: form.get("chamadaGeral") || undefined,
      desprodInicio: form.get("desprodInicio") || undefined,
    };

    const res = await fetch(`/api/projects/${projectId}/shoot-days`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível criar a diária.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar dia
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova diária</DialogTitle>
          <DialogDescription>Preencha os dados básicos — horários podem ser ajustados depois.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="numeroDia">Número do dia</Label>
              <Input id="numeroDia" name="numeroDia" type="number" defaultValue={nextNumeroDia} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="chamadaGeral">Chamada geral</Label>
            <Input id="chamadaGeral" name="chamadaGeral" type="time" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desprodInicio">Desprodução</Label>
            <Input id="desprodInicio" name="desprodInicio" type="time" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar diária"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
