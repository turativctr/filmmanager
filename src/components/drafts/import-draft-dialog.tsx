"use client";

import { Upload, X } from "lucide-react";
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
import { buildScriptFormData, PdfScriptStructureError } from "@/lib/build-script-form-data";
import type { FdxScene, FdxTitlePage } from "@/lib/fdx-parser";
import { isAcceptedScriptFile, UNSUPPORTED_SCRIPT_FORMAT_MESSAGE } from "@/lib/script-file-validation";

type ImportResult = {
  draft: { numero: number; corRevisao: string };
  diffs: { tipo: "ADICIONADA" | "REMOVIDA" | "MODIFICADA"; numero: string }[];
  impacts: { motivo: string; numeroDia: number }[];
};

const NETWORK_ERROR_MESSAGE = "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

export function ImportDraftDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ scenes: FdxScene[]; titlePage: FdxTitlePage } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const uploading = analyzing || importing;

  function reset() {
    setParsed(null);
    setResult(null);
    setError(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAcceptedScriptFile(file.name)) {
      setError(UNSUPPORTED_SCRIPT_FORMAT_MESSAGE);
      setFileName(null);
      e.target.value = "";
      return;
    }
    setError(null);
    setFileName(file.name);
  }

  // Sem isso, depois de um erro (ex.: falha no servidor ao analisar) a única forma de trocar ou
  // desistir do arquivo era reabrir o seletor do sistema — nada indicava que dava pra fazer isso,
  // e não havia como simplesmente "limpar" a seleção e voltar ao estado inicial do campo.
  function handleClearFile() {
    setFileName(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo .fdx ou .pdf.");
      return;
    }
    if (!isAcceptedScriptFile(file.name)) {
      setError(UNSUPPORTED_SCRIPT_FORMAT_MESSAGE);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAnalyzing(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const formData = await buildScriptFormData(file);

      const res = await fetch(`/api/projects/${projectId}/import/fdx`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Não foi possível analisar o arquivo.");
        return;
      }

      setParsed({ scenes: data.scenes, titlePage: data.titlePage });
    } catch (err) {
      if (err instanceof PdfScriptStructureError) {
        setError(err.message);
      } else if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setAnalyzing(false);
      abortControllerRef.current = null;
    }
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
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
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Não foi possível importar a nova versão.");
        return;
      }

      setResult(data as ImportResult);
      router.refresh();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setImporting(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  function handleOpenChange(next: boolean) {
    if (!next && uploading) return;
    setOpen(next);
    if (!next) reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Importar novo tratamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar nova versão do roteiro</DialogTitle>
          <DialogDescription>
            Envie a nova exportação (.fdx ou .pdf). O sistema compara com o roteiro atual e
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
              <Label htmlFor="draft-file">Arquivo .fdx ou .pdf</Label>
              <input
                ref={fileInputRef}
                id="draft-file"
                type="file"
                accept=".fdx,.pdf"
                onChange={handleFileChange}
                className="block w-full rounded-md border px-3 py-2 text-sm"
              />
              {fileName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">Selecionado: {fileName}</span>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    aria-label="Remover arquivo selecionado"
                    className="shrink-0 rounded p-0.5 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Importe o roteiro em .fdx ou .pdf.
                <br />
                O .pdf pode não trazer todos os dados com precisão, revise-os.
              </p>
            </div>
            {error && <p className="text-sm text-erro-fg">{error}</p>}
            <DialogFooter>
              {analyzing && (
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              )}
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
            {error && <p className="text-sm text-erro-fg">{error}</p>}
            <DialogFooter>
              {importing ? (
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              ) : (
                <Button variant="outline" onClick={reset}>
                  Voltar
                </Button>
              )}
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
