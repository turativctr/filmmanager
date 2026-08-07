"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildScriptFormData,
  OPERATION_TIMEOUT_MESSAGE,
  PdfScriptStructureError,
  SCRIPT_OPERATION_TIMEOUT_MS,
} from "@/lib/build-script-form-data";
import type { FdxScene, FdxTitlePage } from "@/lib/fdx-parser";
import { cn } from "@/lib/utils";

import { Step1Dados } from "./step-1-dados";
import { Step2Revisao } from "./step-2-revisao";
import { Step3Confirmacao } from "./step-3-confirmacao";
import { EMPTY_PROJECT_FORM, type PreviewScene, type ProjectFormState } from "./types";

const STEPS = ["Dados do projeto", "Revisão do roteiro", "Confirmação"];

const NETWORK_ERROR_MESSAGE = "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

function mergeTitlePage(current: ProjectFormState, titlePage: FdxTitlePage): ProjectFormState {
  return {
    ...current,
    titulo: current.titulo || titlePage.tituloSugerido || "",
    roteiristas: current.roteiristas || titlePage.roteiristas || "",
    numeroDraft: current.numeroDraft || titlePage.numeroDraft || "",
    dataDraft: current.dataDraft || titlePage.dataDraft || "",
    contatoProducao: current.contatoProducao || titlePage.contatoProducao || "",
  };
}

export function OnboardingWizard() {
  const router = useRouter();
  const abortControllerRef = useRef<AbortController | null>(null);
  // Incrementado a cada operação nova e no cancelamento — permite ignorar resultados/erros de uma
  // extração ou requisição que já foi cancelada mas cujo await ainda não voltou (ex.: extração de
  // PDF que trava: abortar o signal não garante que a promise do pdfjs realmente se resolve).
  const operationIdRef = useRef(0);
  // Distingue abort manual (Cancelar) de abort por timeout — os dois disparam o mesmo AbortError,
  // mas só o timeout deve mostrar uma mensagem de erro.
  const cancelledManuallyRef = useRef(false);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [scenes, setScenes] = useState<PreviewScene[] | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelect(next: File | null) {
    setFile(next);
    setScenes(null);
    setAvisos([]);
  }

  function toggleScene(numero: string) {
    setScenes((prev) => (prev ? prev.map((s) => (s.numero === numero ? { ...s, selected: !s.selected } : s)) : prev));
  }

  async function handleAdvanceFromStep1() {
    if (!form.titulo.trim()) {
      setError("Informe o título do projeto.");
      return;
    }
    setError(null);

    if (!file || scenes) {
      setStep(2);
      return;
    }

    setParsing(true);
    const operationId = ++operationIdRef.current;
    cancelledManuallyRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    // Teto pra extração (client-side) + requisição juntas — ver SCRIPT_OPERATION_TIMEOUT_MS.
    const timeoutId = setTimeout(() => controller.abort(), SCRIPT_OPERATION_TIMEOUT_MS);
    try {
      const formData = await buildScriptFormData(file, controller.signal);
      if (operationIdRef.current !== operationId) return; // cancelado enquanto extraía

      const res = await fetch("/api/projects/onboarding/parse", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (operationIdRef.current !== operationId) return;

      if (!res.ok) {
        setError(data.error ?? "Não foi possível analisar o roteiro.");
        return;
      }

      setScenes((data.scenes as FdxScene[]).map((scene) => ({ ...scene, selected: true })));
      setAvisos((data.avisos as string[]) ?? []);
      setForm((prev) => mergeTitlePage(prev, data.titlePage as FdxTitlePage));
      setStep(2);
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
      if (operationIdRef.current === operationId) {
        setParsing(false);
        abortControllerRef.current = null;
      }
    }
  }

  // Cobre parsing E creating (só um dos dois está em andamento por vez): invalida a operação
  // corrente na hora — mesmo que a extração no navegador não seja de fato interrompível em todo
  // caso, o resultado dela passa a ser ignorado (ver checagens de operationIdRef acima) — então o
  // wizard nunca fica preso esperando algo que talvez nunca volte (o que perderia o formulário
  // já preenchido, já que a única saída seria recarregar a página).
  function handleCancel() {
    cancelledManuallyRef.current = true;
    operationIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setParsing(false);
    setCreating(false);
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);

    const operationId = ++operationIdRef.current;
    cancelledManuallyRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), SCRIPT_OPERATION_TIMEOUT_MS);

    try {
      const selected = (scenes ?? []).filter((s) => s.selected).map(({ selected: _selected, ...scene }) => scene);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projeto: {
            titulo: form.titulo,
            diretor: form.diretor || undefined,
            producao: form.producao || undefined,
            dataInicio: form.dataInicio || undefined,
            dataFim: form.dataFim || undefined,
            roteiristas: form.roteiristas || undefined,
            numeroDraft: form.numeroDraft || undefined,
            dataDraft: form.dataDraft || undefined,
            contatoProducao: form.contatoProducao || undefined,
          },
          scenes: selected,
          arquivoNome: file?.name,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (operationIdRef.current !== operationId) return;

      if (!res.ok) {
        setError(data.error ?? "Não foi possível criar o projeto.");
        return;
      }

      router.push(`/projects/${data.id}`);
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
        setCreating(false);
        abortControllerRef.current = null;
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {STEPS.map((label, index) => {
          const num = index + 1;
          const active = num === step;
          const done = num < step;
          return (
            <button
              key={label}
              type="button"
              onClick={() => done && setStep(num)}
              disabled={!done && !active}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs",
                active && "border-foreground bg-secondary text-secondary-foreground font-semibold",
                done && !active && "text-muted-foreground"
              )}
            >
              <span>Passo {num}</span>
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="max-h-[60vh] overflow-y-auto p-6">
          {step === 1 && (
            <Step1Dados
              form={form}
              onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
              fileName={file?.name ?? null}
              onFileSelect={handleFileSelect}
              onFileError={setError}
            />
          )}
          {step === 2 && (
            <Step2Revisao
              form={form}
              onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
              scenes={scenes}
              avisos={avisos}
              onToggleScene={toggleScene}
            />
          )}
          {step === 3 && <Step3Confirmacao form={form} scenes={scenes} />}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-erro-fg">{error}</p>}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || parsing || creating}
        >
          Voltar
        </Button>
        {step === 1 && (
          <div className="flex gap-2">
            {parsing && (
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
            )}
            <Button type="button" onClick={handleAdvanceFromStep1} disabled={parsing}>
              {parsing ? "Analisando roteiro..." : "Avançar"}
            </Button>
          </div>
        )}
        {step === 2 && (
          <Button type="button" onClick={() => setStep(3)}>
            Avançar
          </Button>
        )}
        {step === 3 && (
          <div className="flex gap-2">
            {creating && (
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
            )}
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Criando..." : "Criar projeto"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
