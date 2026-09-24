/**
 * Quais campos da ligação cena–diária (SceneShootDay) são REGISTRO DE EXECUÇÃO e quais são
 * planejamento. Puro, pra regra ficar testável (npm run verify:execucao).
 *
 * Planejamento é a intenção da AD e pode ser reescrito a cada arrasto: ordem, bloco, prep, Rod — e
 * rodDigitado, que é a marca de "este Rod a AD digitou" e por isso anda junto do Rod.
 * Execução é o que de fato aconteceu naquela diária — status, hora de início real e hora de fim
 * real. Vira relatório de progresso, prestação de contas e justificativa de hora extra: reordenar a
 * diária (rotina quando o dia atrasa) ou salvar a Ordem do Dia NUNCA pode apagar.
 */
export const CAMPOS_DE_EXECUCAO = ["status", "horaInicioReal", "horaFimReal"] as const;
export const CAMPOS_DE_PLANEJAMENTO = ["ordem", "bloco", "prepMin", "rodMin", "rodDigitado"] as const;

export type LinhaDaDiaria = {
  shootDayId: string;
  ordem: number;
  bloco: "MANHA" | "TARDE";
  prepMin: number | null;
  rodMin: number | null;
  rodDigitado: boolean;
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "ADIADA";
  horaInicioReal: string | null;
  horaFimReal: string | null;
};

export type PosicaoDesejada = {
  shootDayId: string;
  ordem: number;
  bloco: "MANHA" | "TARDE";
  prepMin: number | null;
  rodMin: number | null;
  rodDigitado: boolean;
};

/** O que gravar numa linha que já existe. Mesma diária: só planejamento — a execução fica intacta.
 *  Outra diária: a execução pertence à diária em que aconteceu, então a linha recomeça do zero na
 *  nova (a tela confirma com a AD antes de mover). */
export function dadosDaReordenacao(
  atual: Pick<LinhaDaDiaria, "shootDayId">,
  destino: PosicaoDesejada
): PosicaoDesejada & Partial<Pick<LinhaDaDiaria, "status" | "horaInicioReal" | "horaFimReal">> {
  const mudouDeDiaria = atual.shootDayId !== destino.shootDayId;
  return {
    ...destino,
    ...(mudouDeDiaria ? { status: "PENDENTE" as const, horaInicioReal: null, horaFimReal: null } : {}),
  };
}

/** Há registro de execução nesta linha? (o que a tela usa pra avisar antes de mover). */
export function temExecucao(linha: Pick<LinhaDaDiaria, "status" | "horaInicioReal" | "horaFimReal">): boolean {
  return linha.status !== "PENDENTE" || linha.horaInicioReal !== null || linha.horaFimReal !== null;
}
