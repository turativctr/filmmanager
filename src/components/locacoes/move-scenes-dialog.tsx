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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pluralize } from "@/lib/pluralize";

const CRIAR_NOVA = "__criar_nova__";

/** "Separar": o roteiro escreveu "EXT. RUA" cinco vezes e a produção descobriu que são três ruas
 *  diferentes — move só as cenas selecionadas pra outra locação (existente ou recém-criada aqui
 *  mesmo). A locação de origem continua existindo com o que sobrou. */
export function MoveScenesDialog({
  projectId,
  currentLocacaoId,
  otherLocacoes,
  selectedSceneIds,
  open,
  onOpenChange,
  onMoved,
}: {
  projectId: string;
  currentLocacaoId: string;
  otherLocacoes: { id: string; nome: string }[];
  selectedSceneIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string>(otherLocacoes[0]?.id ?? CRIAR_NOVA);
  const [novoNome, setNovoNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    let targetLocacaoId = target;

    if (target === CRIAR_NOVA) {
      if (!novoNome.trim()) {
        setError("Dê um nome pra nova locação.");
        setLoading(false);
        return;
      }
      const createRes = await fetch(`/api/projects/${projectId}/locacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novoNome }),
      });
      if (!createRes.ok) {
        setError("Não foi possível criar a nova locação.");
        setLoading(false);
        return;
      }
      const created = await createRes.json();
      targetLocacaoId = created.locacao.id;
    }

    const res = await fetch(`/api/projects/${projectId}/locacoes/${currentLocacaoId}/move-scenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneIds: selectedSceneIds, targetLocacaoId }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível mover as cenas.");
      return;
    }

    onOpenChange(false);
    onMoved();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover {pluralize(selectedSceneIds.length, "cena")} para outra locação</DialogTitle>
          <DialogDescription>
            A locação atual continua existindo com as cenas que sobrarem.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {otherLocacoes.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
                <SelectItem value={CRIAR_NOVA}>Criar nova locação...</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {target === CRIAR_NOVA && (
            <div className="space-y-1.5">
              <Label htmlFor="novoNome">Nome da nova locação</Label>
              <Input
                id="novoNome"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>
        {error && <p className="text-sm text-erro-fg">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "Movendo..." : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
