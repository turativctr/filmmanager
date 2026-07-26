"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

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
import { formatTimeValue } from "@/lib/time";

type SceneOption = { id: string; numero: string };

type ExtraDefaults = {
  id: string;
  personagem: string;
  quantidade: number;
  chamada: unknown;
  saida: unknown;
  cenas: { sceneId: string }[];
};

export function ExtraFormDialog({
  projectId,
  scenes,
  extra,
  trigger,
}: {
  projectId: string;
  scenes: SceneOption[];
  extra?: ExtraDefaults;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(extra);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(
    new Set(extra?.cenas.map((c) => c.sceneId) ?? [])
  );

  function toggleScene(id: string) {
    setSelectedScenes((prev) => {
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
      personagem: form.get("personagem"),
      quantidade: form.get("quantidade"),
      chamada: form.get("chamada") || undefined,
      saida: form.get("saida") || undefined,
      cenaIds: Array.from(selectedScenes),
    };

    const url = isEdit
      ? `/api/projects/${projectId}/extras/${extra!.id}`
      : `/api/projects/${projectId}/extras`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error?.formErrors?.[0] ?? data.error ?? "Não foi possível salvar a figuração.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova figuração
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar ${extra!.personagem}` : "Nova figuração"}</DialogTitle>
          <DialogDescription>Preencha os dados da figuração.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="personagem">Personagem / descrição</Label>
              <Input
                id="personagem"
                name="personagem"
                placeholder="ex.: Garçom, Cliente do bar"
                defaultValue={extra?.personagem}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                name="quantidade"
                type="number"
                min={1}
                defaultValue={extra?.quantidade ?? 1}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="chamada">Chamada</Label>
              <Input
                id="chamada"
                name="chamada"
                type="time"
                defaultValue={extra ? formatTimeValue(extra.chamada) : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="saida">Saída</Label>
              <Input
                id="saida"
                name="saida"
                type="time"
                defaultValue={extra ? formatTimeValue(extra.saida) : ""}
              />
            </div>
          </div>

          {scenes.length > 0 && (
            <div className="space-y-1.5">
              <Label>Cenas vinculadas</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {scenes.map((scene) => (
                  <label
                    key={scene.id}
                    className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedScenes.has(scene.id)}
                      onCheckedChange={() => toggleScene(scene.id)}
                    />
                    Cena {scene.numero}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar figuração"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
