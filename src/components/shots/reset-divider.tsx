import type { ShotTipoReset } from "@prisma/client";

import { HEAVY_RESETS, RESET_LABEL } from "@/lib/shots-shared";
import { cn } from "@/lib/utils";

/** Linha divisória entre dois planos consecutivos — Correção 1: substitui o bloco âmbar largo
 *  por uma linha fina com texto pequeno centralizado. NENHUM e AJUSTE não exibem nada; TROCA_LENTE
 *  e TROCA_CAMERA usam cor neutra; RESET_POSICAO usa âmbar suave; RESET_COMPLETO usa vermelho suave. */
export function ResetDivider({
  tipoReset,
  tempoResetMin,
  detail,
}: {
  tipoReset: ShotTipoReset;
  tempoResetMin: number | null;
  /** Detalhe opcional entre parênteses, ex.: "(24mm→50mm)" pra TROCA_LENTE. */
  detail?: string;
}) {
  if (tipoReset === "NENHUM" || tipoReset === "AJUSTE") return null;

  const isHeavy = HEAVY_RESETS.includes(tipoReset);

  return (
    <div className="relative border-t border-border py-1.5 text-center">
      <span
        className={cn(
          "relative -top-2.5 bg-background px-2 text-[11px]",
          tipoReset === "RESET_COMPLETO" && "text-red-500",
          tipoReset === "RESET_POSICAO" && "text-amber-600",
          !isHeavy && "text-muted-foreground"
        )}
      >
        ↓ {RESET_LABEL[tipoReset].toLowerCase()}
        {detail ? ` ${detail}` : ""} · +{tempoResetMin ?? 0}min
      </span>
    </div>
  );
}
