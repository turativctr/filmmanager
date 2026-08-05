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
  /** Ritmo dos resets desta diária (nível 3 de "tempos de reset configuráveis") — 100 = sem ajuste. */
  fatorResetPercent: number;
  /** Lista única do dia, já na ordem de filmagem (SceneShootDay.ordem) — bloco não existe mais como
   *  duas listas separadas: itens em índice < almocoIndex são manhã, os demais são tarde. */
  scenes: StripItem[];
  /** Posição do marcador de almoço dentro de `scenes` — arrastar o marcador é o que move este número,
   *  nunca um horário declarado diretamente (ver AlmocoMarker/StripboardBoard). */
  almocoIndex: number;
};

export type BoardState = {
  boneyard: StripItem[];
  days: DayState[];
};

export type ContainerId = "boneyard" | `day:${string}`;

export function dayContainerId(dayId: string): ContainerId {
  return `day:${dayId}`;
}

/** id sortable do marcador de almoço de um dia — único por dia (não por bloco, já que só existe um
 *  marcador), no mesmo namespace de ids que os sceneId dentro do DndContext do Stripboard. */
export function almocoMarkerId(dayId: string): string {
  return `almoco:${dayId}`;
}

export function isAlmocoMarkerId(id: string): id is `almoco:${string}` {
  return id.startsWith("almoco:");
}

export function almocoMarkerDayId(markerId: string): string {
  return markerId.slice("almoco:".length);
}
