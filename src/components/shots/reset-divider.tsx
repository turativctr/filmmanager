"use client";

import type { ShotTipoReset } from "@prisma/client";
import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HEAVY_RESETS, RESET_LABEL, resolveEffectiveResetMin } from "@/lib/shots-shared";
import { cn } from "@/lib/utils";

/** Linha divisória entre dois planos consecutivos — Correção 1: substitui o bloco âmbar largo
 *  por uma linha fina com texto pequeno centralizado. NENHUM e AJUSTE não exibem nada; TROCA_LENTE
 *  e TROCA_CAMERA usam cor neutra; RESET_POSICAO usa âmbar suave; RESET_COMPLETO usa vermelho suave.
 *
 *  "Tempos de reset configuráveis": `tempoResetMin` é o valor computado (padrão do projeto pro
 *  tipo classificado); `tempoResetMinManual` é o ajuste calibrado do plano (nível 2, nulo = segue
 *  o padrão); `fatorResetPercent` é o ritmo do dia (nível 3, default 100 = sem ajuste — quem não
 *  tem uma ShootDay em escopo, como a página de Breakdown, nem passa essa prop). O texto mostrado é
 *  sempre o valor EFETIVO (resolveEffectiveResetMin). Quando `onUpdateManual` é passado, o rótulo
 *  fica clicável pra digitar um ajuste manual; havendo ajuste manual, mostra um indicador discreto
 *  (dot + tooltip) e um botão pra voltar ao padrão — mesmo padrão do "Usar tempo dos planos" já
 *  existente em strip-card.tsx. */
export function ResetDivider({
  tipoReset,
  tempoResetMin,
  tempoResetMinManual = null,
  fatorResetPercent = 100,
  detail,
  onUpdateManual,
}: {
  tipoReset: ShotTipoReset;
  tempoResetMin: number | null;
  tempoResetMinManual?: number | null;
  /** Ritmo do dia (0–500), default 100 = sem ajuste. Omitir quando não há diária em escopo. */
  fatorResetPercent?: number;
  /** Detalhe opcional entre parênteses, ex.: "(24mm→50mm)" pra TROCA_LENTE. */
  detail?: string;
  /** Ausente = divisor só-leitura (ex.: preview de drag, sem plano real em escopo). */
  onUpdateManual?: (min: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (tipoReset === "NENHUM" || tipoReset === "AJUSTE") return null;

  const isHeavy = HEAVY_RESETS.includes(tipoReset);
  const computed = tempoResetMin ?? 0;
  const isManual = tempoResetMinManual != null;
  const base = tempoResetMinManual ?? computed;
  const effective = resolveEffectiveResetMin(computed, tempoResetMinManual, fatorResetPercent);
  const fatorApplied = fatorResetPercent !== 100;

  function startEditing() {
    setDraft(String(base));
    setEditing(true);
  }

  function save() {
    const value = Number(draft);
    if (!Number.isNaN(value) && value >= 0) onUpdateManual?.(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="relative flex items-center justify-center gap-1.5 border-t border-border py-1.5">
        <span className="relative bg-background px-1 text-[11px] text-muted-foreground">
          {RESET_LABEL[tipoReset]}
        </span>
        <input
          type="number"
          autoFocus
          min={0}
          className="h-6 w-14 rounded border bg-background px-1 text-center text-[11px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={save}
        />
        <span className="text-[11px] text-muted-foreground">min</span>
      </div>
    );
  }

  return (
    <div className="relative border-t border-border py-1.5 text-center">
      <span
        className={cn(
          "relative -top-2.5 inline-flex items-center gap-1.5 bg-background px-2 text-[11px]",
          tipoReset === "RESET_COMPLETO" && "text-red-500",
          tipoReset === "RESET_POSICAO" && "text-amber-600",
          !isHeavy && "text-muted-foreground"
        )}
      >
        {onUpdateManual ? (
          <button type="button" onClick={startEditing} className="hover:underline">
            ↓ {RESET_LABEL[tipoReset].toLowerCase()}
            {detail ? ` ${detail}` : ""} · +{effective}min
          </button>
        ) : (
          <span>
            ↓ {RESET_LABEL[tipoReset].toLowerCase()}
            {detail ? ` ${detail}` : ""} · +{effective}min
          </span>
        )}
        {fatorApplied && (
          <Tooltip>
            <TooltipTrigger type="button" className="text-muted-foreground/70">
              (?)
            </TooltipTrigger>
            <TooltipContent>
              {RESET_LABEL[tipoReset]} · {base}min × {fatorResetPercent}% = {effective}min
            </TooltipContent>
          </Tooltip>
        )}
        {isManual && (
          <>
            <Tooltip>
              <TooltipTrigger className="block h-1.5 w-1.5 shrink-0 rounded-full bg-alerta-accent" />
              <TooltipContent>Tempo manual difere do padrão do projeto</TooltipContent>
            </Tooltip>
            {onUpdateManual && (
              <button
                type="button"
                className="text-[10px] text-muted-foreground underline hover:text-foreground"
                onClick={() => onUpdateManual(null)}
              >
                usar padrão
              </button>
            )}
          </>
        )}
      </span>
    </div>
  );
}
