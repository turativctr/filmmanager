"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { FdxScenePreview } from "@/components/shared/fdx-scene-preview";
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
import { Label } from "@/components/ui/label";

import type { FdxScene } from "@/lib/fdx-parser";

type PreviewScene = FdxScene & { selected: boolean };

type ImportResult = { created: number; updated: number; skipped: number };

export function FdxImportDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenes, setScenes] = useState<PreviewScene[] | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [substituirExistentes, setSubstituirExistentes] = useState(false);
  const [criarPersonagens, setCriarPersonagens] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setScenes(null);
    setAvisos([]);
    setError(null);
    setResult(null);
    setSubstituirExistentes(false);
    setCriarPersonagens(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo .fdx.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/projects/${projectId}/import/fdx`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    setAnalyzing(false);

    if (!res.ok) {
      setError(data.error ?? "Não foi possível analisar o arquivo.");
      return;
    }

    setScenes((data.scenes as FdxScene[]).map((scene) => ({ ...scene, selected: true })));
    setAvisos((data.avisos as string[]) ?? []);
  }

  function toggleScene(numero: string) {
    setScenes((prev) =>
      prev
        ? prev.map((s) => (s.numero === numero ? { ...s, selected: !s.selected } : s))
        : prev
    );
  }

  async function handleImport() {
    if (!scenes) return;
    const selected = scenes.filter((s) => s.selected);
    if (selected.length === 0) {
      setError("Selecione ao menos uma cena.");
      return;
    }

    setImporting(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/import/fdx/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenes: selected.map(({ selected: _selected, ...scene }) => scene),
        substituirExistentes,
        criarPersonagens,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setImporting(false);

    if (!res.ok) {
      setError(data.error ?? "Não foi possível importar as cenas.");
      return;
    }

    setResult(data as ImportResult);
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importar roteiro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar roteiro (.fdx ou .wdz)</DialogTitle>
          <DialogDescription>
            Envie a exportação do Final Draft ou WriterDuet para detectar cenas automaticamente.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <p className="text-sm">
              {result.created} cena(s) criada(s), {result.updated} atualizada(s),{" "}
              {result.skipped} ignorada(s) (número já existente).
            </p>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Concluído</Button>
            </DialogFooter>
          </div>
        ) : !scenes ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fdx-file">Arquivo .fdx ou .wdz</Label>
              <input
                ref={fileInputRef}
                id="fdx-file"
                type="file"
                accept=".fdx,.wdz"
                className="block w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? "Analisando..." : "Analisar arquivo"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <FdxScenePreview scenes={scenes} avisos={avisos} onToggleScene={toggleScene} />

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={substituirExistentes}
                  onCheckedChange={(checked) => setSubstituirExistentes(checked === true)}
                />
                Substituir cenas existentes com mesmo número
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={criarPersonagens}
                  onCheckedChange={(checked) => setCriarPersonagens(checked === true)}
                />
                Criar personagens automaticamente
              </label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setScenes(null)} disabled={importing}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importando..." : "Importar selecionadas"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
