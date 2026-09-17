export type SceneSummary = {
  id: string;
  numero: string;
  tipo: "INT" | "EXT" | null;
  // Texto livre — ver o comentário em FdxScene.periodo (src/lib/fdx-parser.ts). classeLuz é o
  // que decide a cor da tira (ver strip-card.tsx); classeLuzFim só existe quando classeLuz é
  // TRANSICAO — é a classe (DIA/NOITE) da PONTA FINAL, resolvida no servidor a partir de
  // periodoFim, pra decidir a direção do degradê sem duplicar deriveClasseLuz no bundle cliente.
  periodo: string | null;
  classeLuz: "DIA" | "NOITE" | "TRANSICAO" | "INDEFINIDO";
  classeLuzFim: "DIA" | "NOITE" | null;
  set: string | null;
  locacao: string | null;
  sinopse: string | null;
  paginas: string;
  diaNarrativo: number | null;
  tempoEstimadoMin: number | null;
  /** Tempo reverso definido pela AD — quando existe, é o Rod da cena (ver Scene.duracaoAlvoMin). */
  duracaoAlvoMin: number | null;
  notasAD: string | null;
  omitida: boolean;
  characterIds: string[];
  /** Mensagem "divisão não fecha" quando a cena é dividida e a soma dos oitavos das partes deixou de
   *  bater com as páginas (editadas depois). null = sem divisão ou fecha. */
  divisaoNaoFecha: string | null;
};

/** Parte de uma cena dividida entre diárias (ScenePart), como a tira precisa dela. */
export type StripParte = {
  id: string;
  rotulo: string;
  oitavos: number;
  /** As OUTRAS partes da mesma cena e onde estão — o vínculo "voice off na diária 5". */
  outras: { rotulo: string; numeroDia: number | null }[];
  /** Rod que a parte deveria ter: soma dos planos atribuídos a ela, ou estimado pelos oitavos. */
  rodMin: number;
  fonteRod: "PLANOS" | "ESTIMADO_PROPORCIONAL" | "MINIMO";
  /** Minutos em planos da cena sem parte — não contam no Rod de nenhuma parte. */
  minSemParte: number;
  /** Tempo estimado proporcional aos oitavos da parte (fallback do Rod no cronograma). */
  tempoEstimadoMin: number | null;
  /** Todas as partes da cena (esta inclusa), pro seletor de parte dos planos. */
  todas: { id: string; rotulo: string; oitavos: number }[];
  oitavosCena: number;
};

/** cortaveisMin: quanto dos planos é DESEJAVEL/SE_DER_TEMPO — o que dá pra cortar se a diária estourar. */
export type ShotsSummary = { count: number; totalMin: number; takesTotal: number; cortaveisMin: number };

export type StripItem = {
  /** Id da tira no arraste: o da parte quando a cena é dividida, senão o da cena. Uma cena dividida
   *  aparece uma vez por parte, então sceneId deixou de ser único no quadro. */
  itemId: string;
  sceneId: string;
  scenePartId: string | null;
  parte: StripParte | null;
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
 *  marcador), no mesmo namespace de ids que os itemId dentro do DndContext do Stripboard. */
export function almocoMarkerId(dayId: string): string {
  return `almoco:${dayId}`;
}

export function isAlmocoMarkerId(id: string): id is `almoco:${string}` {
  return id.startsWith("almoco:");
}

export function almocoMarkerDayId(markerId: string): string {
  return markerId.slice("almoco:".length);
}
