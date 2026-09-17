import { PRIORIDADE_DESCRICAO, PRIORIDADE_LABEL } from "@/lib/shots-shared";
import { cn } from "@/lib/utils";

import type { ShotPrioridade } from "@prisma/client";

// Discreta de propósito: a etiqueta orienta, quem decide é o total de "cortáveis". DESEJAVEL (o
// padrão) é a mais apagada — o que chama atenção é o que foi marcado de fato: o que não pode cair
// e o que cai primeiro.
const ESTILO: Record<ShotPrioridade, string> = {
  ESSENCIAL: "border-foreground/40 bg-foreground/5 font-semibold text-foreground",
  DESEJAVEL: "border-border text-muted-foreground",
  SE_DER_TEMPO: "border-dashed border-alerta-accent/60 text-alerta-fg",
};

export function PrioridadeTag({ prioridade, className }: { prioridade: ShotPrioridade; className?: string }) {
  return (
    <span
      title={`${PRIORIDADE_LABEL[prioridade]} — ${PRIORIDADE_DESCRICAO[prioridade]}`}
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-[10px] leading-4",
        ESTILO[prioridade],
        className
      )}
    >
      {PRIORIDADE_LABEL[prioridade]}
    </span>
  );
}
