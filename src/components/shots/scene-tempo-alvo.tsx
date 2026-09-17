"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { TermTooltip } from "@/components/shared/term-tooltip";
import { Input } from "@/components/ui/input";
import { formatTempoEstimado } from "@/lib/paginas";
import { resolveEffectiveRodMin } from "@/lib/schedule";
import { minutosEmPlanosSemParte, origemRodDaParte, resolveRodDaParte } from "@/lib/scene-parts-shared";
import { computeCortaveisMin, computeSceneShotTotals, resolveRodDaCena } from "@/lib/shots-shared";
import { avaliarTempoAlvo, mensagemMedia, mensagemSaldo, mensagemSetupAcimaDaMedia } from "@/lib/tempo-alvo";
import { cn } from "@/lib/utils";

import type { ShotData } from "@/components/breakdown/shot-types";

/** Cabeçalho de tempo da cena, acima da lista de planos: a AD define quanto tempo a cena tem e vê a
 *  média por plano e o saldo contra o que os planos somam. Tudo aqui é aviso — nada bloqueia salvar
 *  e nada é escrito nos tempos dos planos. Usado no stripboard e no Breakdown. */
export function SceneTempoAlvo({
  projectId,
  sceneId,
  sceneNumero,
  shots,
  initialDuracaoAlvoMin,
  tempoEstimadoMin,
  onSaved,
  mostrarRod = true,
  divisao = null,
}: {
  projectId: string;
  sceneId: string;
  sceneNumero: string;
  shots: ShotData[];
  initialDuracaoAlvoMin: number | null;
  /** Pra dizer de onde vem o Rod quando não há alvo nem planos. */
  tempoEstimadoMin: number | null;
  /** O Rod da cena na diária muda junto — o stripboard usa isto pra recarregar o cronograma. */
  onSaved?: () => void;
  /** false no stripboard: a tira da cena, logo acima, já diz de onde o Rod vem — repetir no mesmo
   *  card só polui. No Breakdown não há tira, então a linha fica. */
  mostrarRod?: boolean;
  /** Cena dividida entre diárias: o Rod é por parte e a duração alvo vira só referência do total. */
  divisao?: { partes: { id: string; rotulo: string; oitavos: number }[]; oitavosCena: number } | null;
}) {
  const [alvo, setAlvo] = useState<number | null>(initialDuracaoAlvoMin);
  const [draft, setDraft] = useState(initialDuracaoAlvoMin?.toString() ?? "");

  useEffect(() => {
    setAlvo(initialDuracaoAlvoMin);
    setDraft(initialDuracaoAlvoMin?.toString() ?? "");
  }, [initialDuracaoAlvoMin]);

  async function commit() {
    const trimmed = draft.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isInteger(value) || value < 1)) {
      setDraft(alvo?.toString() ?? "");
      return;
    }
    if (value === alvo) return;

    const previous = alvo;
    setAlvo(value);
    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/duracao-alvo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duracaoAlvoMin: value }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      onSaved?.();
    } catch (err) {
      console.error("Erro ao salvar duração alvo:", err);
      toast.error("Erro ao salvar — tente novamente");
      setAlvo(previous);
      setDraft(previous?.toString() ?? "");
    }
  }

  // Descartado não roda — não conta na soma nem divide a média. Coverage conta como plano: é setup
  // separado.
  const ativos = shots.filter((s) => s.status !== "DESCARTADO");
  const { totalMin: somaMin } = computeSceneShotTotals(shots);

  const avaliacao =
    alvo === null
      ? null
      : avaliarTempoAlvo({
          alvoMin: alvo,
          somaMin,
          partes: ativos.map((s) => ({ id: s.id, rotulo: `Plano ${s.numero}`, setupMin: s.tempoSetupMin })),
        });

  // Sem alvo, sempre diz de onde o Rod vem — inclusive quando o número mudou "sozinho": apagar o
  // alvo de uma cena sem planos devolve o Rod ao tempo estimado pelos oitavos.
  const origemRodSemAlvo =
    ativos.length > 0
      ? `Rod: ${formatTempoEstimado(somaMin)} (soma dos planos)`
      : tempoEstimadoMin
        ? `Rod: ${formatTempoEstimado(tempoEstimadoMin)} (estimado pelos oitavos — defina a duração alvo pra fixar)`
        : "Rod: sem estimativa — defina a duração alvo ou cadastre planos";

  // Cena dividida (decisão A): cada parte tem o Rod dela — planos atribuídos, ou estimado pelos
  // oitavos. Plano sem parte não entra em nenhuma, e a duração alvo só é comparada com a soma.
  const rodsDasPartes = divisao
    ? divisao.partes.map((p) => ({
        rotulo: p.rotulo,
        ...resolveRodDaParte({
          parteId: p.id,
          oitavosParte: p.oitavos,
          oitavosCena: divisao.oitavosCena,
          tempoEstimadoCenaMin: tempoEstimadoMin,
          planos: shots,
        }),
      }))
    : null;
  const somaDasPartes = rodsDasPartes?.reduce((s, p) => s + p.rodMin, 0) ?? 0;
  const semParteMin = divisao ? minutosEmPlanosSemParte(shots) : 0;

  // "Cena 19 · 90min · 40min em planos cortáveis" — o que a AD procura quando a diária estoura.
  const rodCena = rodsDasPartes
    ? somaDasPartes
    : resolveEffectiveRodMin(resolveRodDaCena({ duracaoAlvoMin: alvo, planos: shots }).rodMin, tempoEstimadoMin);
  // Dividida: plano sem parte não está no Rod de parte nenhuma, então cortá-lo não economiza nada.
  const cortaveisMin = computeCortaveisMin(divisao ? shots.filter((s) => s.scenePartId !== null) : shots);

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 px-3 py-2 text-xs">
      {rodsDasPartes && (
        <div className="space-y-0.5">
          <p className="font-medium text-foreground">
            Cena {sceneNumero} dividida ·{" "}
            {rodsDasPartes
              .map((p) => `${p.rotulo} ${formatTempoEstimado(p.rodMin)} (${origemRodDaParte(p.fonte)})`)
              .join(" · ")}
          </p>
          {rodsDasPartes.some((p) => p.fonte === "MINIMO") && (
            <p className="flex items-center gap-1 font-medium text-alerta-fg">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {rodsDasPartes
                .filter((p) => p.fonte === "MINIMO")
                .map((p) => p.rotulo)
                .join(", ")}
              : Rod de {formatTempoEstimado(rodsDasPartes.find((p) => p.fonte === "MINIMO")!.rodMin)} é o mínimo, não um
              tempo real — atribua planos ou digite o Rod na diária.
            </p>
          )}
          {semParteMin > 0 && (
            <p className="flex items-center gap-1 font-medium text-alerta-fg">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {formatTempoEstimado(semParteMin)} em planos sem parte — não contam no Rod de nenhuma parte
            </p>
          )}
          {alvo !== null && somaDasPartes > alvo && (
            <p className="flex items-center gap-1 font-medium text-erro-fg">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              As partes somam {formatTempoEstimado(somaDasPartes)} e passam da duração alvo em{" "}
              {formatTempoEstimado(somaDasPartes - alvo)}.
            </p>
          )}
        </div>
      )}
      {ativos.length > 0 && (
        <p className="font-medium text-foreground">
          Cena {sceneNumero} · {formatTempoEstimado(rodCena)} ·{" "}
          {cortaveisMin > 0 ? `${formatTempoEstimado(cortaveisMin)} em planos cortáveis` : "nenhum plano cortável"}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`duracao-alvo-${sceneId}`} className="flex items-center gap-1 font-medium text-foreground">
          Duração alvo
          <TermTooltip
            content={
              divisao
                ? "Cena dividida entre diárias: a duração alvo é só referência do total. O Rod de cada parte vem dos planos atribuídos a ela (ou do estimado pelos oitavos dela), e aqui aparece um aviso se a soma das partes passar do alvo."
                : "Quanto tempo a cena tem. Preenchido, vira o Rod da cena no cronograma e mostra quanto cabe por plano. Vazio, o Rod vem da soma dos planos, como sempre, ou do tempo estimado pelos oitavos se a cena não tem planos. Nunca altera os tempos dos planos."
            }
          />
        </label>
        <Input
          id={`duracao-alvo-${sceneId}`}
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="—"
          className="h-7 w-20 text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <span className="text-muted-foreground">min{divisao ? " · referência do total" : ""}</span>
        {avaliacao && !divisao && <span className="text-muted-foreground">· {mensagemMedia(avaliacao, "plano", "planos")}</span>}
      </div>

      {divisao ? null : avaliacao ? (
        <>
          {mostrarRod && (
            <p className="text-muted-foreground">
              Rod: {formatTempoEstimado(avaliacao.alvoMin)} (definido)
              {ativos.length > 0 && ` · planos somam ${formatTempoEstimado(somaMin)}`}
            </p>
          )}
          {ativos.length > 0 && (
            <p className={cn("font-medium", avaliacao.estourou ? "text-erro-fg" : "text-muted-foreground")}>
              {mensagemSaldo(avaliacao, "A cena", "os planos")}
            </p>
          )}
          {avaliacao.mediaSeg !== null && avaliacao.setupsAcimaDaMedia.length > 0 && (
            <ul className="space-y-0.5 text-alerta-fg">
              {avaliacao.setupsAcimaDaMedia.map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {p.rotulo}: {mensagemSetupAcimaDaMedia(p.setupMin, avaliacao.mediaSeg!)}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        mostrarRod && <p className="text-muted-foreground">{origemRodSemAlvo}</p>
      )}
    </div>
  );
}
