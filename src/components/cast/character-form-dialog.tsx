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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHARACTER_CATEGORIA_LABEL, CHARACTER_CATEGORIA_ORDER } from "@/lib/character-categoria";

import type { CharacterCategoria } from "@prisma/client";

type SceneOption = { id: string; numero: string };

type CharacterDefaults = {
  id: string;
  idCurto: string;
  categoria: CharacterCategoria;
  personagem: string;
  ator: string | null;
  idadePersonagem: number | null;
  scenes: { sceneId: string }[];
};

export function CharacterFormDialog({
  projectId,
  scenes,
  character,
  trigger,
}: {
  projectId: string;
  scenes: SceneOption[];
  character?: CharacterDefaults;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(character);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string>(character?.categoria ?? "PRINCIPAL");
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(
    new Set(character?.scenes.map((s) => s.sceneId) ?? [])
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
      idCurto: form.get("idCurto"),
      categoria,
      personagem: form.get("personagem"),
      ator: form.get("ator") || undefined,
      idadePersonagem: form.get("idadePersonagem") || undefined,
      sceneIds: Array.from(selectedScenes),
    };

    const url = isEdit
      ? `/api/projects/${projectId}/characters/${character!.id}`
      : `/api/projects/${projectId}/characters`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error?.formErrors?.[0] ?? data.error ?? "Não foi possível salvar o personagem.");
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
            Novo personagem
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar ${character!.personagem}` : "Novo personagem"}</DialogTitle>
          <DialogDescription>Preencha os dados do personagem.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="idCurto">ID curto</Label>
              <Input
                id="idCurto"
                name="idCurto"
                placeholder="ex.: PRO1, CHEF2"
                defaultValue={character?.idCurto}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHARACTER_CATEGORIA_ORDER.map((option) => (
                    <SelectItem key={option} value={option}>
                      {CHARACTER_CATEGORIA_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="personagem">Personagem</Label>
            <Input id="personagem" name="personagem" defaultValue={character?.personagem} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ator">Ator</Label>
              <Input id="ator" name="ator" defaultValue={character?.ator ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idadePersonagem">Idade do personagem</Label>
              <Input
                id="idadePersonagem"
                name="idadePersonagem"
                type="number"
                defaultValue={character?.idadePersonagem ?? ""}
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
              {loading ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar personagem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
