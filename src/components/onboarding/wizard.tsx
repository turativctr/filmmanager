"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildScriptFormData, PdfScriptStructureError } from "@/lib/build-script-form-data";
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
    try {
      const formData = await buildScriptFormData(file);
      const res = await fetch("/api/projects/onboarding/parse", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Não foi possível analisar o roteiro.");
        return;
      }

      setScenes((data.scenes as FdxScene[]).map((scene) => ({ ...scene, selected: true })));
      setAvisos((data.avisos as string[]) ?? []);
      setForm((prev) => mergeTitlePage(prev, data.titlePage as FdxTitlePage));
      setStep(2);
    } catch (err) {
      if (err instanceof PdfScriptStructureError) {
        setError(err.message);
      } else {
        setError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setParsing(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);

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
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Não foi possível criar o projeto.");
        return;
      }

      router.push(`/projects/${data.id}`);
      router.refresh();
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
    } finally {
      setCreating(false);
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
          <Button type="button" onClick={handleAdvanceFromStep1} disabled={parsing}>
            {parsing ? "Analisando roteiro..." : "Avançar"}
          </Button>
        )}
        {step === 2 && (
          <Button type="button" onClick={() => setStep(3)}>
            Avançar
          </Button>
        )}
        {step === 3 && (
          <Button type="button" onClick={handleCreate} disabled={creating}>
            {creating ? "Criando..." : "Criar projeto"}
          </Button>
        )}
      </div>
    </div>
  );
}
