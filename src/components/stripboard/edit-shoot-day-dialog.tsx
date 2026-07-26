"use client";

import { Settings } from "lucide-react";
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
import type { DayState } from "./types";

export function EditShootDayDialog({ projectId, day }: { projectId: string; day: DayState }) {
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
      lancheHorario: form.get("lancheHorario") || undefined,
      desprodInicio: form.get("desprodInicio") || undefined,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${day.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        setError("Não foi possível salvar os horários.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Falha ao salvar horários da diária:", err);
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "O servidor demorou demais para responder. Tente novamente."
          : "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."
      );
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Editar horários do dia">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Diária {day.numeroDia}</DialogTitle>
          <DialogDescription>
            Horários da diária. Bloco manhã/tarde e almoço são calculados a partir da chamada geral e do
            marcador de almoço no Stripboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="numeroDia">Número do dia</Label>
              <Input id="numeroDia" name="numeroDia" type="number" defaultValue={day.numeroDia} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                name="data"
                type="date"
                defaultValue={day.data.slice(0, 10)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="chamadaGeral">Chamada geral</Label>
              <Input id="chamadaGeral" name="chamadaGeral" type="time" defaultValue={day.chamadaGeral ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lancheHorario">Lanche</Label>
              <Input id="lancheHorario" name="lancheHorario" type="time" defaultValue={day.lancheHorario ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desprodInicio">Desprodução</Label>
            <Input
              id="desprodInicio"
              name="desprodInicio"
              type="time"
              defaultValue={day.desprodInicio ?? ""}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar horários"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
