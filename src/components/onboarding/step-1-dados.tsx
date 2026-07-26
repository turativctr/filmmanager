"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ProjectFormState } from "./types";

export function Step1Dados({
  form,
  onChange,
  fileName,
  onFileSelect,
}: {
  form: ProjectFormState;
  onChange: (patch: Partial<ProjectFormState>) => void;
  fileName: string | null;
  onFileSelect: (file: File | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="titulo">Título</Label>
          <Input
            id="titulo"
            value={form.titulo}
            onChange={(e) => onChange({ titulo: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="diretor">Diretor</Label>
            <Input id="diretor" value={form.diretor} onChange={(e) => onChange({ diretor: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="producao">Produção</Label>
            <Input id="producao" value={form.producao} onChange={(e) => onChange({ producao: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="dataInicio">Início das filmagens</Label>
            <Input
              id="dataInicio"
              type="date"
              value={form.dataInicio}
              onChange={(e) => onChange({ dataInicio: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dataFim">Fim das filmagens</Label>
            <Input
              id="dataFim"
              type="date"
              value={form.dataFim}
              onChange={(e) => onChange({ dataFim: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5 rounded-md border border-dashed p-4">
        <Label htmlFor="roteiro-file" className="flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Roteiro (.fdx ou .wdz) — opcional
        </Label>
        <p className="text-xs text-muted-foreground">
          Envie a exportação do Final Draft ou WriterDuet para criar automaticamente as cenas e
          personagens do projeto (todos ficam no Boneyard, prontos para agendar). Pode pular esta
          etapa e importar depois.
        </p>
        <input
          ref={fileInputRef}
          id="roteiro-file"
          type="file"
          accept=".fdx,.wdz"
          className="block w-full rounded-md border px-3 py-2 text-sm"
          onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
        />
        {fileName && <p className="text-xs text-muted-foreground">Selecionado: {fileName}</p>}
      </div>
    </div>
  );
}
