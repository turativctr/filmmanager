"use client";

import { Upload, X } from "lucide-react";
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

import {
  buildScriptFormData,
  OPERATION_TIMEOUT_MESSAGE,
  PdfScriptStructureError,
  SCRIPT_OPERATION_TIMEOUT_MS,
} from "@/lib/build-script-form-data";
import type { FdxScene } from "@/lib/fdx-parser";
import { isAcceptedScriptFile, UNSUPPORTED_SCRIPT_FORMAT_MESSAGE } from "@/lib/script-file-validation";

type PreviewScene = FdxScene & { selected: boolean };

type ImportResult = { created: number; updated: number; skipped: number };

const NETWORK_ERROR_MESSAGE = "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

export function FdxImportDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Incrementado a cada operação nova e no cancelamento — permite ignorar resultados/erros de uma
  // extração ou requisição que já foi cancelada mas cujo await ainda não voltou (ex.: extração de
  // PDF que trava: abortar o signal não garante que a promise do pdfjs realmente se resolve).
  const operationIdRef = useRef(0);
  // Distingue abort manual (Cancelar) de abort por timeout — os dois disparam o mesmo AbortError,
  // mas só o timeout deve mostrar uma mensagem de erro.
  const cancelledManuallyRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenes, setScenes] = useState<PreviewScene[] | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [substituirExistentes, setSubstituirExistentes] = useState(false);
  const [criarPersonagens, setCriarPersonagens] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const uploading = analyzing || importing;

  function reset() {
    operationIdRef.current += 1;
    setScenes(null);
    setAvisos([]);
    setError(null);
    setResult(null);
    setSubstituirExistentes(false);
    setCriarPersonagens(true);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Valida a extensão AQUI, antes de qualquer requisição ou extração — nada é iniciado pra um
    // arquivo de formato errado, então não há como isso deixar o diálogo num estado de carregando.
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

    const operationId = ++operationIdRef.current;
    cancelledManuallyRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    // Teto pra extração (client-side) + requisição juntas — ver SCRIPT_OPERATION_TIMEOUT_MS.
    const timeoutId = setTimeout(() => controller.abort(), SCRIPT_OPERATION_TIMEOUT_MS);

    try {
      const formData = await buildScriptFormData(file, controller.signal);
      if (operationIdRef.current !== operationId) return; // cancelado enquanto extraía

      const res = await fetch(`/api/projects/${projectId}/import/fdx`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (operationIdRef.current !== operationId) return;

      if (!res.ok) {
        setError(data.error ?? "Não foi possível analisar o arquivo.");
        return;
      }

      setScenes((data.scenes as FdxScene[]).map((scene) => ({ ...scene, selected: true })));
      setAvisos((data.avisos as string[]) ?? []);
    } catch (err) {
      if (operationIdRef.current !== operationId) return; // já cancelado, ignora erro tardio
      if (err instanceof PdfScriptStructureError) {
        setError(err.message);
      } else if (err instanceof DOMException && err.name === "AbortError") {
        if (!cancelledManuallyRef.current) setError(OPERATION_TIMEOUT_MESSAGE);
      } else {
        setError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      clearTimeout(timeoutId);
      // Só libera o loading se esta ainda for a operação corrente — senão um resultado tardio de
      // uma extração já cancelada reabriria o loading de uma operação nova que foi iniciada
      // depois (ex.: a pessoa cancelou e já selecionou outro arquivo).
      if (operationIdRef.current === operationId) {
        setAnalyzing(false);
        abortControllerRef.current = null;
      }
    }
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

    const operationId = ++operationIdRef.current;
    cancelledManuallyRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), SCRIPT_OPERATION_TIMEOUT_MS);

    try {
      const res = await fetch(`/api/projects/${projectId}/import/fdx/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: selected.map(({ selected: _selected, ...scene }) => scene),
          substituirExistentes,
          criarPersonagens,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (operationIdRef.current !== operationId) return;

      if (!res.ok) {
        setError(data.error ?? "Não foi possível importar as cenas.");
        return;
      }

      setResult(data as ImportResult);
      router.refresh();
    } catch (err) {
      if (operationIdRef.current !== operationId) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        if (!cancelledManuallyRef.current) setError(OPERATION_TIMEOUT_MESSAGE);
      } else {
        setError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      clearTimeout(timeoutId);
      if (operationIdRef.current === operationId) {
        setImporting(false);
        abortControllerRef.current = null;
      }
    }
  }

  // Cobre analyzing E importing (só um dos dois está em andamento por vez): invalida a operação
  // corrente na hora — mesmo que a extração no navegador não seja de fato interrompível em todo
  // caso, o resultado dela passa a ser ignorado (ver checagens de operationIdRef acima) — então o
  // diálogo nunca fica preso esperando algo que talvez nunca volte.
  function handleCancel() {
    cancelledManuallyRef.current = true;
    operationIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAnalyzing(false);
    setImporting(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next && uploading) return;
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
          <DialogTitle>Importar roteiro (.fdx ou .pdf)</DialogTitle>
          <DialogDescription>
            Envie a exportação do Final Draft ou um PDF do roteiro para detectar cenas automaticamente.
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
              <Label htmlFor="fdx-file">Arquivo .fdx ou .pdf</Label>
              <input
                ref={fileInputRef}
                id="fdx-file"
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

            {error && <p className="text-sm text-erro-fg">{error}</p>}
            <DialogFooter>
              {importing ? (
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setScenes(null)}>
                  Voltar
                </Button>
              )}
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
