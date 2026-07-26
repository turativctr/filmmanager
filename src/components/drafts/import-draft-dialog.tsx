"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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
import { Label } from "@/components/ui/label";
import type { FdxScene, FdxTitlePage } from "@/lib/fdx-parser";

type ImportResult = {
  draft: { numero: number; corRevisao: string };
  diffs: { tipo: "ADICIONADA" | "REMOVIDA" | "MODIFICADA"; numero: string }[];
  impacts: { motivo: string; numeroDia: number }[];
};

export function ImportDraftDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ scenes: FdxScene[]; titlePage: FdxTitlePage } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setParsed(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo .fdx ou .wdz.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/projects/${projectId}/import/fdx`, { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    setAnalyzing(false);

    if (!res.ok) {
      setError(data.error ?? "Não foi possível analisar o arquivo.");
      return;
    }

    setParsed({ scenes: data.scenes, titlePage: data.titlePage });
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setError(null);

    const fileName = fileInputRef.current?.files?.[0]?.name;
    const res = await fetch(`/api/projects/${projectId}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenes: parsed.scenes,
        numeroDraft: parsed.titlePage.numeroDraft ?? undefined,
        dataDraft: parsed.titlePage.dataDraft ?? undefined,
        arquivoNome: fileName,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setImporting(false);

    if (!res.ok) {
      setError(data.error ?? "Não foi possível importar a nova versão.");
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
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Importar nova versão
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar nova versão do roteiro</DialogTitle>
          <DialogDescription>
            Envie a nova exportação (.fdx ou .wdz). O sistema compara com o roteiro atual e
            registra automaticamente o que mudou.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm">
              Draft {result.draft.numero} ({result.draft.corRevisao}) criado —{" "}
              {result.diffs.filter((d) => d.tipo === "ADICIONADA").length} nova(s),{" "}
              {result.diffs.filter((d) => d.tipo === "REMOVIDA").length} omitida(s),{" "}
              {result.diffs.filter((d) => d.tipo === "MODIFICADA").length} modificada(s).
            </p>
            {result.impacts.length > 0 && (
              <div className="rounded-md border border-destructive bg-destructive/10 p-2 text-sm text-destructive">
                {result.impacts.map((impact, i) => (
                  <p key={i}>
                    Diária {impact.numeroDia}: {impact.motivo}
                  </p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Concluído</Button>
            </DialogFooter>
          </div>
        ) : !parsed ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="draft-file">Arquivo .fdx ou .wdz</Label>
              <input
                ref={fileInputRef}
                id="draft-file"
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
            <p className="text-sm">
              {parsed.scenes.length} cena(s) detectada(s) no arquivo
              {parsed.titlePage.numeroDraft ? ` — ${parsed.titlePage.numeroDraft}` : ""}
              {parsed.titlePage.dataDraft ? ` (${parsed.titlePage.dataDraft})` : ""}.
            </p>
            <p className="text-xs text-muted-foreground">
              O sistema vai comparar essas cenas com o roteiro atual do projeto e registrar
              automaticamente o que foi adicionado, removido (marcado OMITIDA) ou modificado.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={reset} disabled={importing}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importando..." : "Confirmar importação"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
