"use client";

import type { HoraAHoraEventTipo } from "@prisma/client";
import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HORA_A_HORA_TIPO_LABELS } from "@/lib/hora-a-hora";

export type HoraAHoraEventDefaults = {
  id: string;
  horaInicio: string;
  horaFim: string | null;
  descricao: string;
  tipo: HoraAHoraEventTipo;
};

export function HoraAHoraEventDialog({
  projectId,
  shootDayId,
  event,
  trigger,
  onSaved,
}: {
  projectId: string;
  shootDayId: string;
  event?: HoraAHoraEventDefaults;
  trigger?: ReactNode;
  onSaved: (event: HoraAHoraEventDefaults & { geradoAutomaticamente: boolean; ordem: number }) => void;
}) {
  const isEdit = Boolean(event);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<HoraAHoraEventTipo>(event?.tipo ?? "OUTRO");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      horaInicio: form.get("horaInicio"),
      horaFim: form.get("horaFim") || null,
      descricao: form.get("descricao"),
      tipo,
    };

    const url = isEdit
      ? `/api/projects/${projectId}/shoot-days/${shootDayId}/hora-a-hora/${event!.id}`
      : `/api/projects/${projectId}/shoot-days/${shootDayId}/hora-a-hora`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error?.formErrors?.[0] ?? data.error ?? "Não foi possível salvar o evento.");
      return;
    }

    const saved = await res.json();
    setOpen(false);
    onSaved(saved);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Evento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>Eventos manuais não são afetados por &quot;Regenerar automáticos&quot;.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="horaInicio">Início</Label>
              <Input id="horaInicio" name="horaInicio" type="time" defaultValue={event?.horaInicio ?? ""} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="horaFim">Fim (opcional)</Label>
              <Input id="horaFim" name="horaFim" type="time" defaultValue={event?.horaFim ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" name="descricao" defaultValue={event?.descricao ?? ""} required />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as HoraAHoraEventTipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(HORA_A_HORA_TIPO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : isEdit ? "Salvar alterações" : "Adicionar evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
