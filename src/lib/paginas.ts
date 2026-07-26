/**
 * Formato Hollywood de páginas de roteiro: frações de oitavo.
 * Ex.: "1/8", "2/8", "1 2/8", "3 3/8".
 */

const WHOLE_ONLY = /^(\d+)$/;
const FRACTION_ONLY = /^([1-7])\/8$/;
const WHOLE_AND_FRACTION = /^(\d+)\s+([1-7])\/8$/;

/** Converte um texto em formato de oitavos para um número decimal (ex.: "1 2/8" -> 1.25). */
export function parsePaginas(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return 0;

  let whole = 0;
  let numerator = 0;

  const wholeAndFractionMatch = trimmed.match(WHOLE_AND_FRACTION);
  const fractionOnlyMatch = trimmed.match(FRACTION_ONLY);
  const wholeOnlyMatch = trimmed.match(WHOLE_ONLY);

  if (wholeAndFractionMatch) {
    whole = parseInt(wholeAndFractionMatch[1], 10);
    numerator = parseInt(wholeAndFractionMatch[2], 10);
  } else if (fractionOnlyMatch) {
    numerator = parseInt(fractionOnlyMatch[1], 10);
  } else if (wholeOnlyMatch) {
    whole = parseInt(wholeOnlyMatch[1], 10);
  } else {
    return null;
  }

  return whole + numerator / 8;
}

/** Converte um valor decimal (número, string ou Decimal) para o formato de oitavos (ex.: 1.25 -> "1 2/8"). */
export function formatPaginas(value: unknown): string {
  const num = Number(value?.toString() ?? 0);
  if (!Number.isFinite(num) || num < 0) return "0";

  const eighths = Math.round(num * 8);
  const whole = Math.floor(eighths / 8);
  const numerator = eighths % 8;

  if (whole === 0 && numerator === 0) return "0";
  if (numerator === 0) return `${whole}`;
  if (whole === 0) return `${numerator}/8`;
  return `${whole} ${numerator}/8`;
}

export function isValidPaginasInput(input: string): boolean {
  return parsePaginas(input) !== null;
}

/** 1/8 de página de roteiro ≈ 5 min de filmagem. */
export function suggestTempoEstimadoMin(paginas: number): number {
  return Math.round(paginas * 8 * 5);
}
