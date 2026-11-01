// Tempos de cena e de diária (tempo estimado, duração alvo, prep, Rod, setup, reset, almoço,
// jornada, blocos): guardados em MINUTOS inteiros, digitados e exibidos como relógio H:MM — "1:30" é
// uma hora e meia. Diferente da duração do take, que é M:SS (parseDuracaoTake em shots-shared.ts).
// Sem dependência de servidor: importável em componente cliente.

/** 90 → "1:30", 5 → "0:05", -15 → "-0:15". */
export function formatHoraMin(min: number): string {
  const total = Math.round(Math.abs(min));
  const sinal = min < 0 && total > 0 ? "-" : "";
  return `${sinal}${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** null/undefined viram "" (campo vazio). */
export function formatHoraMinOuVazio(min: number | null | undefined): string {
  return min == null ? "" : formatHoraMin(min);
}

/** Lê o que a AD digitou: "1:30", "0:05", "1h30", "1h", "45min" ou número puro — número puro é
 *  MINUTOS, que é o que esses campos sempre foram ("90" continua sendo 90 minutos). `negativo`
 *  aceita "-0:15" (atraso adiantado). Devolve null se estiver vazio ou não der pra ler — quem chama
 *  decide se vazio é válido (testando o texto antes). */
export function parseHoraMin(raw: string, { negativo = false }: { negativo?: boolean } = {}): number | null {
  let text = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (text === "") return null;
  let sinal = 1;
  if (text.startsWith("-")) {
    if (!negativo) return null;
    sinal = -1;
    text = text.slice(1);
  }

  let min: number | null = null;
  let m: RegExpExecArray | null;
  if (/^\d+$/.test(text)) {
    min = Number(text);
  } else if ((m = /^(\d+):(\d{1,2})$/.exec(text))) {
    min = Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
  } else if ((m = /^(\d+)h(\d{1,2})?(min|m)?$/.exec(text))) {
    const minutos = m[2] ? Number(m[2]) : 0;
    min = minutos < 60 ? Number(m[1]) * 60 + minutos : null;
  } else if ((m = /^(\d+)(min|m)$/.exec(text))) {
    min = Number(m[1]);
  }
  return min === null ? null : sinal * min;
}

export const PLACEHOLDER_HORA_MIN = "0:00";
export const TITULO_HORA_MIN = "Horas:minutos — 1:30 é uma hora e meia; número puro vale minutos";
