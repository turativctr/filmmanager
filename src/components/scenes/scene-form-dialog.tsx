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
import { Textarea } from "@/components/ui/textarea";
import { getCharacterId } from "@/lib/character-id";
import { formatPaginas, parsePaginas, suggestTempoEstimadoMin } from "@/lib/paginas";

type CharacterOption = {
  id: string;
  idCurto: string;
  numeroElenco: number | null;
  personagem: string;
};

const TIPO_INDEFINIDO = "INDEFINIDO";
const PERIODO_INDEFINIDO = "INDEFINIDO";
const SEM_LOCACAO = "__sem_locacao__";
const CRIAR_NOVA_LOCACAO = "__criar_nova_locacao__";

type SceneDefaults = {
  id: string;
  numero: string;
  tipo: "INT" | "EXT" | null;
  periodo: "DIA" | "NOITE" | "ENTARDECER" | "AMANHECER" | "CONTINUO" | "DEPOIS" | "NOITE_PARA_DIA" | "DIA_PARA_NOITE" | null;
  set: string | null;
  locacao: { id: string; nome: string } | null;
  sinopse: string | null;
  paginas: unknown;
  diaNarrativo: number | null;
  tempoEstimadoMin: number | null;
  notasAD: string | null;
  cast: { characterId: string }[];
};

export function SceneFormDialog({
  projectId,
  characters,
  sistemaIdElenco,
  locacoes,
  scene,
  trigger,
}: {
  projectId: string;
  characters: CharacterOption[];
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  locacoes: { id: string; nome: string }[];
  scene?: SceneDefaults;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(scene);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string>(scene ? scene.tipo ?? TIPO_INDEFINIDO : "INT");
  const [periodo, setPeriodo] = useState<string>(scene ? scene.periodo ?? PERIODO_INDEFINIDO : "DIA");
  const [locacaoId, setLocacaoId] = useState<string>(scene?.locacao?.id ?? SEM_LOCACAO);
  const [novaLocacaoNome, setNovaLocacaoNome] = useState("");
  const [selectedCast, setSelectedCast] = useState<Set<string>>(
    new Set(scene?.cast.map((c) => c.characterId) ?? [])
  );
  const [tempoSugerido, setTempoSugerido] = useState<number | null>(() => {
    if (!scene) return null;
    const paginas = parsePaginas(formatPaginas(scene.paginas));
    return paginas != null ? suggestTempoEstimadoMin(paginas) : null;
  });

  function handlePaginasChange(e: React.ChangeEvent<HTMLInputElement>) {
    const paginas = parsePaginas(e.target.value);
    setTempoSugerido(paginas != null ? suggestTempoEstimadoMin(paginas) : null);
  }

  function toggleCharacter(id: string) {
    setSelectedCast((prev) => {
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

    let resolvedLocacaoId: string | null = locacaoId === SEM_LOCACAO ? null : locacaoId;

    if (locacaoId === CRIAR_NOVA_LOCACAO) {
      if (!novaLocacaoNome.trim()) {
        setError("Dê um nome pra nova locação.");
        setLoading(false);
        return;
      }
      const createRes = await fetch(`/api/projects/${projectId}/locacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novaLocacaoNome }),
      });
      if (!createRes.ok) {
        setError("Não foi possível criar a locação.");
        setLoading(false);
        return;
      }
      const created = await createRes.json();
      resolvedLocacaoId = created.locacao.id;
    }

    const form = new FormData(e.currentTarget);
    const payload = {
      numero: form.get("numero"),
      tipo: tipo === TIPO_INDEFINIDO ? null : tipo,
      periodo: periodo === PERIODO_INDEFINIDO ? null : periodo,
      set: form.get("set") || undefined,
      locacaoId: resolvedLocacaoId,
      sinopse: form.get("sinopse") || undefined,
      paginas: form.get("paginas"),
      diaNarrativo: form.get("diaNarrativo") || undefined,
      tempoEstimadoMin: form.get("tempoEstimadoMin") || undefined,
      notasAD: form.get("notasAD") || undefined,
      characterIds: Array.from(selectedCast),
    };

    const url = isEdit
      ? `/api/projects/${projectId}/scenes/${scene!.id}`
      : `/api/projects/${projectId}/scenes`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        data.error?.fieldErrors?.paginas?.[0] ??
          data.error?.formErrors?.[0] ??
          data.error ??
          "Não foi possível salvar a cena."
      );
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
            Nova cena
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar cena ${scene!.numero}` : "Nova cena"}</DialogTitle>
          <DialogDescription>Preencha os dados da cena.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="numero">Número</Label>
              <Input id="numero" name="numero" defaultValue={scene?.numero} required />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INT">INT</SelectItem>
                  <SelectItem value="EXT">EXT</SelectItem>
                  <SelectItem value={TIPO_INDEFINIDO}>Não definido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Período</Label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIA">Dia</SelectItem>
                  <SelectItem value="NOITE">Noite</SelectItem>
                  <SelectItem value="ENTARDECER">Entardecer</SelectItem>
                  <SelectItem value="AMANHECER">Amanhecer</SelectItem>
                  <SelectItem value="CONTINUO">Contínuo</SelectItem>
                  <SelectItem value="DEPOIS">Depois</SelectItem>
                  <SelectItem value="NOITE_PARA_DIA">Noite para dia</SelectItem>
                  <SelectItem value="DIA_PARA_NOITE">Dia para noite</SelectItem>
                  <SelectItem value={PERIODO_INDEFINIDO}>Não definido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="set">Set</Label>
              <Input id="set" name="set" defaultValue={scene?.set ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Locação</Label>
              <Select value={locacaoId} onValueChange={setLocacaoId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_LOCACAO}>Sem locação definida</SelectItem>
                  {locacoes.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                    </SelectItem>
                  ))}
                  <SelectItem value={CRIAR_NOVA_LOCACAO}>Criar nova locação...</SelectItem>
                </SelectContent>
              </Select>
              {locacaoId === CRIAR_NOVA_LOCACAO && (
                <Input
                  className="mt-1.5"
                  placeholder="Nome da nova locação"
                  value={novaLocacaoNome}
                  onChange={(e) => setNovaLocacaoNome(e.target.value)}
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sinopse">Sinopse</Label>
            <Textarea id="sinopse" name="sinopse" defaultValue={scene?.sinopse ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notasAD">Notas do AD</Label>
            <Textarea
              id="notasAD"
              name="notasAD"
              placeholder="Anotação livre — aparece na Escaleta e no Stripboard"
              defaultValue={scene?.notasAD ?? ""}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="paginas">Páginas</Label>
              <Input
                id="paginas"
                name="paginas"
                placeholder="ex.: 1 2/8"
                defaultValue={scene ? formatPaginas(scene.paginas) : ""}
                onChange={handlePaginasChange}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diaNarrativo">Dia narrativo</Label>
              <Input
                id="diaNarrativo"
                name="diaNarrativo"
                type="number"
                defaultValue={scene?.diaNarrativo ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tempoEstimadoMin">Tempo estimado (min)</Label>
              <Input
                id="tempoEstimadoMin"
                name="tempoEstimadoMin"
                type="number"
                defaultValue={scene?.tempoEstimadoMin ?? ""}
              />
              {tempoSugerido != null && (
                <p className="text-xs text-muted-foreground">
                  Sugestão baseada nas oitavas: ~{tempoSugerido} min
                </p>
              )}
            </div>
          </div>

          {characters.length > 0 && (
            <div className="space-y-1.5">
              <Label>Elenco na cena</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {characters.map((character) => (
                  <label
                    key={character.id}
                    className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedCast.has(character.id)}
                      onCheckedChange={() => toggleCharacter(character.id)}
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
              {loading ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar cena"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
