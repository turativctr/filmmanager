"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { TagListInput } from "@/components/shared/tag-list-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCharacterId } from "@/lib/character-id";

type CharacterOption = { id: string; idCurto: string; numeroElenco: number | null; personagem: string };
type ExtraOption = { id: string; personagem: string; quantidade: number };

type BreakdownData = {
  figurino: string[];
  make: string[];
  arteDressing: string;
  objetos: string[];
  comidaCena: string[];
  microfones: string[];
  trilha: string[];
  habilidades: string[];
  arteGrafica: string[];
  posProducao: string[];
  notasArte: string;
  notasFoto: string;
  notasSom: string;
  notasContinuidade: string;
  notasProducao: string;
};

const EMPTY_BREAKDOWN: BreakdownData = {
  figurino: [],
  make: [],
  arteDressing: "",
  objetos: [],
  comidaCena: [],
  microfones: [],
  trilha: [],
  habilidades: [],
  arteGrafica: [],
  posProducao: [],
  notasArte: "",
  notasFoto: "",
  notasSom: "",
  notasContinuidade: "",
  notasProducao: "",
};

export function BreakdownForm({
  projectId,
  sceneId,
  sistemaIdElenco,
  initialTempoEstimadoMin,
  allCharacters,
  initialCastIds,
  allExtras,
  initialLinkedExtraIds,
  initialBreakdown,
}: {
  projectId: string;
  sceneId: string;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  initialTempoEstimadoMin: number | null;
  allCharacters: CharacterOption[];
  initialCastIds: string[];
  allExtras: ExtraOption[];
  initialLinkedExtraIds: string[];
  initialBreakdown: Partial<BreakdownData> | null;
}) {
  const [tempoEstimadoMin, setTempoEstimadoMin] = useState<string>(
    initialTempoEstimadoMin?.toString() ?? ""
  );
  const [castIds, setCastIds] = useState<Set<string>>(new Set(initialCastIds));
  const [linkedExtraIds, setLinkedExtraIds] = useState<Set<string>>(
    new Set(initialLinkedExtraIds)
  );
  const [breakdown, setBreakdown] = useState<BreakdownData>({
    ...EMPTY_BREAKDOWN,
    ...initialBreakdown,
  });
  const [newExtraName, setNewExtraName] = useState("");
  const [newExtraQty, setNewExtraQty] = useState("1");
  const [extras, setExtras] = useState(allExtras);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const lastSnapshotRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  function field<K extends keyof BreakdownData>(key: K, value: BreakdownData[K]) {
    setBreakdown((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCast(id: string) {
    setCastIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExtraLink(id: string) {
    setLinkedExtraIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addExtra() {
    const personagem = newExtraName.trim();
    if (!personagem) return;

    const res = await fetch(`/api/projects/${projectId}/extras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personagem,
        quantidade: Number(newExtraQty) || 1,
        cenaIds: [sceneId],
      }),
    });

    if (res.ok) {
      const created = await res.json();
      setExtras((prev) => [...prev, created]);
      setLinkedExtraIds((prev) => new Set(prev).add(created.id));
      setNewExtraName("");
      setNewExtraQty("1");
    }
  }

  useEffect(() => {
    const snapshot = JSON.stringify({
      tempoEstimadoMin,
      castIds: Array.from(castIds).sort(),
      linkedExtraIds: Array.from(linkedExtraIds).sort(),
      breakdown,
    });

    // Só dispara o autosave quando o estado realmente muda — evita o efeito
    // fantasma do double-invoke do Strict Mode disparar um PATCH no mount.
    if (lastSnapshotRef.current === null) {
      lastSnapshotRef.current = snapshot;
      return;
    }
    if (snapshot === lastSnapshotRef.current) {
      return;
    }
    lastSnapshotRef.current = snapshot;

    setStatus("saving");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      const payload = {
        tempoEstimadoMin: tempoEstimadoMin === "" ? null : Number(tempoEstimadoMin),
        characterIds: Array.from(castIds),
        extraLinks: extras.map((extra) => ({
          extraId: extra.id,
          linked: linkedExtraIds.has(extra.id),
        })),
        ...breakdown,
      };

      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/breakdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setStatus(res.ok ? "saved" : "error");
    }, 800);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempoEstimadoMin, castIds, linkedExtraIds, breakdown]);

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        {status === "saving" && <span>Salvando...</span>}
        {status === "saved" && <span>Salvo</span>}
        {status === "error" && <span className="text-destructive">Erro ao salvar</span>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Elenco</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="tempoEstimadoMin">Tempo estimado da cena (min)</Label>
            <Input
              id="tempoEstimadoMin"
              type="number"
              value={tempoEstimadoMin}
              onChange={(e) => setTempoEstimadoMin(e.target.value)}
            />
          </div>
          {allCharacters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum personagem cadastrado no projeto ainda.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {allCharacters.map((character) => (
                <label
                  key={character.id}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={castIds.has(character.id)}
                    onCheckedChange={() => toggleCast(character.id)}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {getCharacterId(character, { sistemaIdElenco })}
                  </span>
                  {character.personagem}
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Figuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {extras.length > 0 && (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {extras.map((extra) => (
                <label
                  key={extra.id}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={linkedExtraIds.has(extra.id)}
                    onCheckedChange={() => toggleExtraLink(extra.id)}
                  />
                  {extra.personagem}{" "}
                  <span className="text-muted-foreground">({extra.quantidade})</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Nova figuração (ex.: Garçom)"
              value={newExtraName}
              onChange={(e) => setNewExtraName(e.target.value)}
            />
            <Input
              type="number"
              min={1}
              className="w-20"
              value={newExtraQty}
              onChange={(e) => setNewExtraQty(e.target.value)}
            />
            <Button type="button" variant="outline" size="icon" onClick={addExtra}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Figurino</CardTitle>
        </CardHeader>
        <CardContent>
          <TagListInput
            value={breakdown.figurino}
            onChange={(v) => field("figurino", v)}
            placeholder="ex.: Chef_R2 uniforme"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maquiagem / Cabelo / Efeitos</CardTitle>
        </CardHeader>
        <CardContent>
          <TagListInput
            value={breakdown.make}
            onChange={(v) => field("make", v)}
            placeholder="ex.: Chef_R2 suor"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arte / Dressing</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={breakdown.arteDressing}
            onChange={(e) => field("arteDressing", e.target.value)}
            placeholder="Descrição livre da ambientação da cena"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objetos de cena</CardTitle>
        </CardHeader>
        <CardContent>
          <TagListInput
            value={breakdown.objetos}
            onChange={(v) => field("objetos", v)}
            placeholder="ex.: Salão_mesa, Cozinha_panela, PRO_celular"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comida de cena</CardTitle>
        </CardHeader>
        <CardContent>
          <TagListInput
            value={breakdown.comidaCena}
            onChange={(v) => field("comidaCena", v)}
            placeholder="ex.: Prato de moqueca"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Som — microfones</CardTitle>
        </CardHeader>
        <CardContent>
          <TagListInput
            value={breakdown.microfones}
            onChange={(v) => field("microfones", v)}
            placeholder="ex.: Chef, Protagonista"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trilha / Músicas</CardTitle>
        </CardHeader>
        <CardContent>
          <TagListInput
            value={breakdown.trilha}
            onChange={(v) => field("trilha", v)}
            placeholder="ex.: Tema do restaurante"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Habilidades do elenco</CardTitle>
        </CardHeader>
        <CardContent>
          <TagListInput
            value={breakdown.habilidades}
            onChange={(v) => field("habilidades", v)}
            placeholder="ex.: Chef_Assobiar"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arte gráfica</CardTitle>
        </CardHeader>
        <CardContent>
          <TagListInput
            value={breakdown.arteGrafica}
            onChange={(v) => field("arteGrafica", v)}
            placeholder="ex.: Cardápio impresso"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pós-produção</CardTitle>
        </CardHeader>
        <CardContent>
          <TagListInput
            value={breakdown.posProducao}
            onChange={(v) => field("posProducao", v)}
            placeholder="ex.: Flashback, VFX, câmera lenta"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas por departamento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Arte</Label>
            <Textarea
              value={breakdown.notasArte}
              onChange={(e) => field("notasArte", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Foto / Maq / Elétrica</Label>
            <Textarea
              value={breakdown.notasFoto}
              onChange={(e) => field("notasFoto", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Som</Label>
            <Textarea
              value={breakdown.notasSom}
              onChange={(e) => field("notasSom", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Continuidade</Label>
            <Textarea
              value={breakdown.notasContinuidade}
              onChange={(e) => field("notasContinuidade", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Produção</Label>
            <Textarea
              value={breakdown.notasProducao}
              onChange={(e) => field("notasProducao", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
