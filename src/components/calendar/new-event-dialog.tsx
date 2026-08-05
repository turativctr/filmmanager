"use client";

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
import { getCharacterId } from "@/lib/character-id";

import { EVENT_TYPE_LABEL } from "./calendar-badge";
import type { CalendarEventType } from "./types";

type CharacterOption = { id: string; idCurto: string; numeroElenco: number | null; personagem: string };

/** Controlado de fora — o gatilho é um item do menu "Novo evento / Nova tarefa" no cabeçalho do
 *  Calendário (ver CalendarBoard), não um botão próprio. */
export function NewEventDialog({
  projectId,
  characters,
  sistemaIdElenco,
  defaultDate,
  open,
  onOpenChange,
}: {
  projectId: string;
  characters: CharacterOption[];
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  defaultDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<CalendarEventType>("ENSAIO");
  const [selectedElementos, setSelectedElementos] = useState<Set<string>>(new Set());

  function toggleElemento(id: string) {
    setSelectedElementos((prev) => {
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
    const payload = {
      data: form.get("data"),
      tipo,
      nome: form.get("nome"),
      elementosAfetados: Array.from(selectedElementos),
    };

    const res = await fetch(`/api/projects/${projectId}/calendar-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível criar o evento.");
      return;
    }

    onOpenChange(false);
    setSelectedElementos(new Set());
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo evento</DialogTitle>
          <DialogDescription>Adicione um evento avulso, folga ou feriado.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={defaultDate} required />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as CalendarEventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome do evento</Label>
            <Input id="nome" name="nome" placeholder="ex.: Ensaio de elenco" required />
          </div>

          {characters.length > 0 && (
            <div className="space-y-1.5">
              <Label>Elenco envolvido (opcional)</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {characters.map((character) => (
                  <label
                    key={character.id}
                    className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedElementos.has(character.id)}
                      onCheckedChange={() => toggleElemento(character.id)}
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      {getCharacterId(character, { sistemaIdElenco })}
                    </span>
                    {character.personagem}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
