export type SceneSummary = {
  id: string;
  numero: string;
  tipo: "INT" | "EXT" | null;
  periodo: "DIA" | "NOITE" | "ENTARDECER" | "AMANHECER" | "CONTINUO" | "DEPOIS" | null;
  set: string | null;
  locacao: string | null;
  sinopse: string | null;
  paginas: string;
  diaNarrativo: number | null;
  tempoEstimadoMin: number | null;
  notasAD: string | null;
  omitida: boolean;
  characterIds: string[];
};

export type ShotsSummary = { count: number; totalMin: number; takesTotal: number };

export type StripItem = {
  sceneId: string;
  prepMin: number | null;
  rodMin: number | null;
  scene: SceneSummary;
  shotsSummary: ShotsSummary | null;
  /** Notas operacionais do AD pra esta cena NESTA diária (SceneShootDay.observacoes) — só existe
   *  quando a cena está de fato agendada num dia (undefined no Boneyard, onde não há SceneShootDay). */
  observacoes?: string | null;
  observacoesAutoGeradas?: boolean;
};

export type DayState = {
  id: string;
  numeroDia: number;
  data: string;
  chamadaGeral: string | null;
  lancheHorario: string | null;
  blocoManhaInicio: string | null;
  almocoInicio: string | null;
  almocoFim: string | null;
  blocoTardeInicio: string | null;
  desprodInicio: string | null;
  manha: StripItem[];
  tarde: StripItem[];
};

export type BoardState = {
  boneyard: StripItem[];
  days: DayState[];
};

export type ContainerId = "boneyard" | `day:${string}:MANHA` | `day:${string}:TARDE`;

export function dayContainerId(dayId: string, bloco: "MANHA" | "TARDE"): ContainerId {
  return `day:${dayId}:${bloco}`;
}
