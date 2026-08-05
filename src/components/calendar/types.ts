export type CalendarEventType = "ENSAIO" | "VIAGEM" | "FIGURINO" | "FERIADO" | "FOLGA" | "OUTRO";

export type CastPresente = {
  characterId: string;
  idCurto: string;
  numeroElenco: number | null;
  personagem: string;
  chamada: string | null;
  saida: string | null;
};

export type CalendarShootDaySummary = {
  id: string;
  numeroDia: number;
  set: string | null;
  locacao: string | null;
  totalPaginas: string;
  totalMinutos: number;
  scenes: { numero: string; sinopse: string | null }[];
  scenesSemTempoCount: number;
  chamadaGeral: string | null;
  blocoManhaInicio: string | null;
  almocoInicio: string | null;
  almocoFim: string | null;
  blocoTardeInicio: string | null;
  desprodInicio: string | null;
  castPresente: CastPresente[];
};

export type CalendarMonthSummary = {
  totalDiasFilmagem: number;
  totalPaginas: string;
  totalMinutos: number;
  totalCenas: number;
};

export type CalendarEventSummary = {
  id: string;
  tipo: CalendarEventType;
  nome: string;
  elementosAfetados: string[];
};

export type CalendarTaskSummary = {
  id: string;
  titulo: string;
  responsavel: string | null;
  concluida: boolean;
};

export type CalendarDayData = {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  shootDay: CalendarShootDaySummary | null;
  events: CalendarEventSummary[];
  tasks: CalendarTaskSummary[];
};
