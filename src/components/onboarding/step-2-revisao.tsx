"use client";

import { FdxScenePreview } from "@/components/shared/fdx-scene-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { PreviewScene, ProjectFormState } from "./types";

export function Step2Revisao({
  form,
  onChange,
  scenes,
  avisos,
  onToggleScene,
}: {
  form: ProjectFormState;
  onChange: (patch: Partial<ProjectFormState>) => void;
  scenes: PreviewScene[] | null;
  avisos: string[];
  onToggleScene: (numero: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-semibold">Metadados extraídos do roteiro</p>
        <p className="text-xs text-muted-foreground">
          Extraído automaticamente da página de rosto do roteiro — revise e corrija antes de criar
          o projeto.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="roteiristas">Roteirista(s)</Label>
            <Input
              id="roteiristas"
              value={form.roteiristas}
              onChange={(e) => onChange({ roteiristas: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="numeroDraft">Draft</Label>
            <Input
              id="numeroDraft"
              value={form.numeroDraft}
              onChange={(e) => onChange({ numeroDraft: e.target.value })}
              placeholder="ex.: 3rd Draft"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="dataDraft">Data do draft</Label>
            <Input
              id="dataDraft"
              value={form.dataDraft}
              onChange={(e) => onChange({ dataDraft: e.target.value })}
              placeholder="ex.: March 3, 2024"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contatoProducao">Contato da produção</Label>
            <Input
              id="contatoProducao"
              value={form.contatoProducao}
              onChange={(e) => onChange({ contatoProducao: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Cenas detectadas</p>
        {!scenes ? (
          <p className="text-sm text-muted-foreground">
            Nenhum roteiro enviado no Passo 1 — o projeto será criado sem cenas. Você pode
            importar um roteiro depois na aba Cenas.
          </p>
        ) : (
          <FdxScenePreview scenes={scenes} avisos={avisos} onToggleScene={onToggleScene} />
        )}
      </div>
    </div>
  );
}
