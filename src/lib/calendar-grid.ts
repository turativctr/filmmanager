export type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

/** Grade de 42 dias (6 semanas) cobrindo o mês, com padding dos meses vizinhos. Tudo em UTC. */
export function getMonthGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay();

  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - startWeekday);

  const days: CalendarDay[] = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    days.push({
      date: new Date(cursor),
      isCurrentMonth: cursor.getUTCMonth() === month - 1,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function toDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

export function addMonths(year: number, month: number, delta: number) {
  const total = (year * 12 + (month - 1)) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const WEEKDAY_NAMES_FULL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function weekdayNameFull(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return WEEKDAY_NAMES_FULL[d.getUTCDay()];
}

/** "01 de setembro de 2025", usado nos cabeçalhos dos relatórios em PDF. */
export function formatFullDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${String(d.getUTCDate()).padStart(2, "0")} de ${MONTH_NAMES[d.getUTCMonth()].toLowerCase()} de ${d.getUTCFullYear()}`;
}

/** "45 min" abaixo de uma hora, "2h15"/"3h00" a partir de 60 min. */
export function formatMinutos(totalMin: number): string {
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}
