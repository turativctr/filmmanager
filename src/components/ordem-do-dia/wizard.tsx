"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MissingTimesDialog } from "@/components/shared/missing-times-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { gerarNomeArquivo } from "@/lib/filename";
import { computeAutoFillPrepMin, computeAutoFillRodMin, minutesToTime, timeToMinutes } from "@/lib/schedule";
import { computeSceneShotTotals } from "@/lib/shots-shared";
import { cn } from "@/lib/utils";

import { Step1Locacao } from "./step-1-locacao";
import { Step2Elenco } from "./step-2-elenco";
import { Step2Tempos } from "./step-2-tempos";
import { Step3Alertas } from "./step-3-alertas";
import { Step4Revisao } from "./step-4-revisao";
import type {
  CastRow,
  ExtraRow,
  LocacaoInfo,
  LogisticsState,
  MeteoState,
  Passo3Data,
  SceneTimeRow,
  ShootDayInfo,
  ShotSummary,
} from "./types";

const STEPS = ["Locação e logística", "Tempos e ritmo", "Alertas e habilidades", "Meteorologia e revisão"];

function buildInitialLogistics(shootDay: ShootDayInfo, locacaoInfo: LocacaoInfo): LogisticsState {
  const locacao = locacaoInfo.locacao;
  const locacaoNome = shootDay.locacaoNome || locacao?.nome || "";
  const locacaoEndereco = shootDay.locacaoEndereco || locacao?.endereco || "";
  const transporteHorario =
    shootDay.transporteHorario ||
    (shootDay.chamadaGeral ? minutesToTime(timeToMinutes(shootDay.chamadaGeral) - 30) : "");
  const baseInfo = shootDay.baseInfo || (locacaoEndereco ? `Na locação (${locacaoEndereco})` : "");
  const estacionamento = shootDay.estacionamento || (locacaoEndereco ? "Ruas próximas à locação" : "");

  return {
    locacaoNome,
    locacaoEndereco,
    transporteHorario,
    transporteEndereco: shootDay.transporteEndereco ?? "",
    baseInfo,
    estacionamento,
    hospitalNome: shootDay.hospitalNome || locacao?.hospitalNome || "",
    hospitalEndereco: shootDay.hospitalEndereco || locacao?.hospitalEndereco || "",
    hospitalTelefone: shootDay.hospitalTelefone || locacao?.hospitalTelefone || "",
  };
}

function buildInitialMeteo(shootDay: ShootDayInfo): MeteoState {
  return {
    meteoNascer: shootDay.meteoNascer ?? "",
    meteoPor: shootDay.meteoPor ?? "",
    meteoMin: shootDay.meteoMin?.toString() ?? "",
    meteoMax: shootDay.meteoMax?.toString() ?? "",
    meteoChuva: shootDay.meteoChuva ?? "",
    meteoDescricao: shootDay.meteoDescricao ?? "",
    observacoesGerais: shootDay.observacoesGerais ?? "",
    observacaoCronogramaElenco: shootDay.observacaoCronogramaElenco ?? "",
    observacaoPlanoSimples: shootDay.observacaoPlanoSimples ?? "",
  };
}

async function downloadPdf(
  projectId: string,
  shootDayId: string,
  numeroDia: number,
  projeto: { titulo: string; sigla: string | null }
) {
  const res = await fetch(`/api/projects/${projectId}/reports/callsheet?day=${shootDayId}`);
  if (!res.ok) return;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = gerarNomeArquivo({ projeto, tipo: "OD", variante: `Diaria${numeroDia}`, ext: "pdf" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function OrdemDoDiaWizard({
  projectId,
  shootDay,
  projeto,
  locacaoInfo,
  castRows: initialCastRows,
  extraRows: initialExtraRows,
  chamadaEquipeInicial,
  passo3,
  sceneTimeRows: initialSceneTimeRows,
  initialStep,
}: {
  projectId: string;
  shootDay: ShootDayInfo;
  projeto: { titulo: string; sigla: string | null };
  locacaoInfo: LocacaoInfo;
  castRows: CastRow[];
  extraRows: ExtraRow[];
  chamadaEquipeInicial: Record<string, string>;
  passo3: Passo3Data;
  sceneTimeRows: SceneTimeRow[];
  initialStep?: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMissingTimesDialog, setShowMissingTimesDialog] = useState(false);

  const [logistics, setLogistics] = useState<LogisticsState>(() =>
    buildInitialLogistics(shootDay, locacaoInfo)
  );
  const [meteo, setMeteo] = useState<MeteoState>(() => buildInitialMeteo(shootDay));
  const [castRows, setCastRows] = useState(initialCastRows);
  const [extraRows, setExtraRows] = useState(initialExtraRows);
  const [chamadaEquipe, setChamadaEquipe] = useState(chamadaEquipeInicial);
  const [sceneTimeRows, setSceneTimeRows] = useState(initialSceneTimeRows);

  function updateCast(id: string, patch: Partial<Pick<CastRow, "chamada" | "camarim" | "set" | "saida">>) {
    setCastRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function recalcularTodos() {
    setCastRows((prev) =>
      prev.map((row) => ({
        ...row,
        chamada: row.autoChamada,
        camarim: row.autoCamarim,
        set: row.autoSet,
        saida: row.autoSaida,
      }))
    );
  }

  function updateExtra(id: string, patch: Partial<Pick<ExtraRow, "chamada" | "saida">>) {
    setExtraRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateSceneTime(sceneId: string, patch: Partial<Pick<SceneTimeRow, "prepMin" | "rodMin">>) {
    setSceneTimeRows((prev) => prev.map((row) => (row.sceneId === sceneId ? { ...row, ...patch } : row)));
  }

  // Chamado após editar um plano inline no Passo 2 — a rota PATCH de Shot já recalcula e
  // persiste SceneShootDay.rodMin no servidor (ver recalculateScene em lib/shots.ts), então
  // aqui só refletimos localmente os planos frescos e o Rod recalculado, sem re-POST pro
  // /stripboard/reorder.
  function updateSceneShots(sceneId: string, shots: ShotSummary[]) {
    setSceneTimeRows((prev) =>
      prev.map((row) => {
        if (row.sceneId !== sceneId) return row;
        const shotsTotal = shots.length > 0 ? computeSceneShotTotals(shots) : null;
        return { ...row, shots, shotsTotal, rodMin: shotsTotal ? shotsTotal.totalMin : row.rodMin };
      })
    );
  }

  function distribuirTemposAutomaticamente() {
    setSceneTimeRows((prev) => {
      const manha = prev.filter((r) => r.bloco === "MANHA").sort((a, b) => a.ordem - b.ordem);
      const tarde = prev.filter((r) => r.bloco === "TARDE").sort((a, b) => a.ordem - b.ordem);

      function recomputeBloco(rows: SceneTimeRow[]): SceneTimeRow[] {
        return rows.map((row, index) => ({
          ...row,
          rodMin: computeAutoFillRodMin(row.tempoEstimadoMin),
          prepMin: computeAutoFillPrepMin(rows[index - 1], row, 90),
        }));
      }

      const recomputed = new Map([...recomputeBloco(manha), ...recomputeBloco(tarde)].map((r) => [r.sceneId, r]));
      return prev.map((row) => recomputed.get(row.sceneId) ?? row);
    });
  }

  async function handleSalvarEGerarPdf() {
    setSaving(true);
    setError(null);

    const meteoMinNum = meteo.meteoMin === "" ? undefined : Number(meteo.meteoMin);
    const meteoMaxNum = meteo.meteoMax === "" ? undefined : Number(meteo.meteoMax);

    const shootDayRes = await fetch(`/api/projects/${projectId}/shoot-days/${shootDay.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numeroDia: shootDay.numeroDia,
        data: shootDay.data,
        ...logistics,
        meteoNascer: meteo.meteoNascer || undefined,
        meteoPor: meteo.meteoPor || undefined,
        meteoMin: meteoMinNum,
        meteoMax: meteoMaxNum,
        meteoChuva: meteo.meteoChuva || undefined,
        meteoDescricao: meteo.meteoDescricao || undefined,
        observacoesGerais: meteo.observacoesGerais || undefined,
        observacaoCronogramaElenco: meteo.observacaoCronogramaElenco || undefined,
        observacaoPlanoSimples: meteo.observacaoPlanoSimples || undefined,
        chamadaEquipe,
      }),
    });

    const callTimesRes = await fetch(`/api/projects/${projectId}/shoot-days/${shootDay.id}/call-times`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callTimes: castRows.map((row) => ({
          characterId: row.id,
          chamada: row.chamada,
          camarim: row.camarim,
          set: row.set,
          saida: row.saida,
        })),
      }),
    });

    const extraResults = await Promise.all(
      extraRows.map((row) =>
        fetch(`/api/projects/${projectId}/extras/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personagem: row.personagem,
            quantidade: row.quantidade,
            chamada: row.chamada,
            saida: row.saida,
          }),
        })
      )
    );

    const sceneTimesRes = await fetch(`/api/projects/${projectId}/stripboard/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changes: sceneTimeRows.map((row) => ({
          sceneId: row.sceneId,
          shootDayId: shootDay.id,
          bloco: row.bloco,
          ordem: row.ordem,
          prepMin: row.prepMin,
          rodMin: row.rodMin,
        })),
      }),
    });

    setSaving(false);

    if (!shootDayRes.ok || !callTimesRes.ok || !sceneTimesRes.ok || extraResults.some((r) => !r.ok)) {
      setError("Não foi possível salvar todos os dados. Tente novamente.");
      return;
    }

    await downloadPdf(projectId, shootDay.id, shootDay.numeroDia, projeto);
    router.push(`/projects/${projectId}/shootdays/${shootDay.id}`);
    router.refresh();
  }

  const scenesSemTempoCount = sceneTimeRows.filter((r) => !r.rodMin || r.rodMin === 0).length;

  function handleSalvarEGerarPdfClick() {
    if (scenesSemTempoCount > 0) {
      setShowMissingTimesDialog(true);
      return;
    }
    handleSalvarEGerarPdf();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Ordem do Dia — Diária ${shootDay.numeroDia} — ${new Date(shootDay.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`}
      />

      <div className="flex items-center gap-2">
        {STEPS.map((label, index) => {
          const num = index + 1;
          const active = num === step;
          const done = num < step;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setStep(num)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs",
                active && "border-foreground bg-secondary font-semibold",
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
            <Step1Locacao
              logistics={logistics}
              onChange={(p) => setLogistics((s) => ({ ...s, ...p }))}
              locacaoInfo={locacaoInfo}
            />
          )}
          {step === 2 && (
            <div className="space-y-6">
              <Step2Tempos
                rows={sceneTimeRows}
                blocoManhaInicio={shootDay.blocoManhaInicio}
                almocoInicio={shootDay.almocoInicio}
                almocoFim={shootDay.almocoFim}
                blocoTardeInicio={shootDay.blocoTardeInicio}
                projectId={projectId}
                onRowChange={updateSceneTime}
                onDistribuir={distribuirTemposAutomaticamente}
                onShotsUpdated={updateSceneShots}
              />
              <Step2Elenco
                castRows={castRows}
                onCastChange={updateCast}
                onRecalcularTodos={recalcularTodos}
                extraRows={extraRows}
                onExtraChange={updateExtra}
                chamadaEquipe={chamadaEquipe}
                onChamadaEquipeChange={(dept, valor) => setChamadaEquipe((prev) => ({ ...prev, [dept]: valor }))}
              />
            </div>
          )}
          {step === 3 && <Step3Alertas data={passo3} projectId={projectId} shootDayId={shootDay.id} />}
          {step === 4 && (
            <Step4Revisao
              meteo={meteo}
              onChange={(p) => setMeteo((s) => ({ ...s, ...p }))}
              logistics={logistics}
              castRows={castRows}
              extraRows={extraRows}
              numeroDia={shootDay.numeroDia}
            />
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          Voltar
        </Button>
        {step < 4 ? (
          <Button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))}>
            Avançar
          </Button>
        ) : (
          <Button type="button" onClick={handleSalvarEGerarPdfClick} disabled={saving}>
            {saving ? "Salvando..." : "Salvar e gerar PDF"}
          </Button>
        )}
      </div>

      <MissingTimesDialog
        open={showMissingTimesDialog}
        onOpenChange={setShowMissingTimesDialog}
        count={scenesSemTempoCount}
        onPreencherAgora={() => setStep(2)}
        onContinuarAssimMesmo={handleSalvarEGerarPdf}
      />
    </div>
  );
}
