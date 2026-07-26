/**
 * Sequência de cores de revisão no padrão da indústria (popularmente chamada de "cores WGA",
 * embora seja uma convenção de produção/duplicação, não uma regra do sindicato). O draft
 * original sai em Branco; cada revisão subsequente usa a próxima cor da lista. Depois de
 * esgotar a lista (9 drafts), o ciclo reinicia com prefixo de rodada ("2ª Azul", "3ª Azul"...)
 * — esse comportamento pós-Cereja varia por produção, então tratamos como um padrão gerável
 * em vez de tentar enumerar uma 10ª cor "oficial" que não existe de forma consensual.
 */

const REVISION_COLORS = ["Azul", "Rosa", "Amarelo", "Verde", "Goldenrod", "Buff", "Salmão", "Cereja"];

export function revisionColorForDraftNumero(numero: number): string {
  if (numero <= 1) return "Branco";

  const revisionIndex = numero - 2;
  const cycle = Math.floor(revisionIndex / REVISION_COLORS.length);
  const color = REVISION_COLORS[revisionIndex % REVISION_COLORS.length];

  return cycle === 0 ? color : `${cycle + 1}ª ${color}`;
}

/** Aproximação hexadecimal de cada cor de revisão, para badges/PDFs — com a cor de texto (branco ou preto) que garante contraste. */
const REVISION_COLOR_HEX: Record<string, { bg: string; text: string }> = {
  Branco: { bg: "#FFFFFF", text: "#000000" },
  Azul: { bg: "#0066CC", text: "#FFFFFF" },
  Rosa: { bg: "#E0559B", text: "#FFFFFF" },
  Amarelo: { bg: "#F2C438", text: "#000000" },
  Verde: { bg: "#2E7D32", text: "#FFFFFF" },
  Goldenrod: { bg: "#B8860B", text: "#FFFFFF" },
  Buff: { bg: "#C9A66B", text: "#000000" },
  Salmão: { bg: "#E9967A", text: "#000000" },
  Cereja: { bg: "#8B0024", text: "#FFFFFF" },
};

/** Extrai a cor-base de um rótulo possivelmente ciclado ("2ª Azul" -> "Azul") e retorna bg/text para um badge. */
export function revisionColorHex(corRevisao: string): { bg: string; text: string } {
  const baseColor = corRevisao.replace(/^\d+ª\s+/, "");
  return REVISION_COLOR_HEX[baseColor] ?? { bg: "#EEEEEE", text: "#000000" };
}
