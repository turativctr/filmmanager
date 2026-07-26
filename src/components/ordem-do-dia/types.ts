import type {
  ContinuidadeAlert,
  DepartmentNoteGroup,
  QuickChangeAlert,
  SceneTextEntry,
} from "@/lib/ordem-do-dia";
import type { ShootDayReportData } from "@/lib/report-data";
import type { PendingGapAlert, ResumptionAlert } from "@/lib/shots-shared";

export type MakeDisplayEntry = { idCurto: string; descricao: string; sceneLabel: string; especial: boolean };

export type ShootDayInfo = ShootDayReportData["shootDay"];

/** Subconjunto de Shot usado no Passo 2 (Tempos) — expandir a cena revela seus planos. */
export type ShotSummary = Pick<
  ShootDayReportData["scenes"][number]["shots"][number],
  | "id"
  | "ordem"
  | "numero"
  | "tamanho"
  | "lente"
  | "takesPrevistos"
  | "duracaoTakeMin"
  | "tempoSetupMin"
  | "tempoTotalMin"
  | "tipoReset"
  | "tempoResetMin"
  | "status"
>;

export type SceneTimeRow = Pick<
  ShootDayReportData["scenes"][number],
  | "sceneId"
  | "bloco"
  | "ordem"
  | "numero"
  | "setLocacaoDisplay"
  | "set"
  | "locacao"
  | "sinopse"
  | "sinopseAD"
  | "tempoEstimadoMin"
  | "prepMin"
  | "rodMin"
> & {
  /** Planos da cena (Passo 2 — expandir a linha). Ausente/undefined até a cena ter planos cadastrados. */
  shots?: ShotSummary[];
  /** Totais de Rod calculados a partir dos planos — presente quando a cena já tem planos. */
  shotsTotal?: { planosMin: number; resetsMin: number; totalMin: number; count: number } | null;
};

export type CastRow = {
  id: string;
  idCurto: string;
  personagem: string;
  ator: string | null;
  cenas: string[];
  chamada: string | null;
  camarim: string | null;
  set: string | null;
  saida: string | null;
  autoChamada: string | null;
  autoCamarim: string | null;
  autoSet: string | null;
  autoSaida: string | null;
};

export type ExtraRow = {
  id: string;
  personagem: string;
  quantidade: number;
  chamada: string | null;
  saida: string | null;
};

export type Passo3Data = {
  habilidades: string[];
  figurino: string[];
  quickChanges: QuickChangeAlert[];
  make: MakeDisplayEntry[];
  objetosCriticos: SceneTextEntry[];
  objetosNormais: SceneTextEntry[];
  comidaCena: SceneTextEntry[];
  notes: DepartmentNoteGroup[];
  posProducao: SceneTextEntry[];
  trilha: SceneTextEntry[];
  microfones: string[];
  continuidadeAlerts: ContinuidadeAlert[];
  resumptionAlerts: ResumptionAlert[];
  pendingGapAlerts: PendingGapAlert[];
  observacoesPorCena: SceneTextEntry[];
};

export type LogisticsState = {
  locacaoNome: string;
  locacaoEndereco: string;
  transporteHorario: string;
  transporteEndereco: string;
  baseInfo: string;
  estacionamento: string;
  hospitalNome: string;
  hospitalEndereco: string;
  hospitalTelefone: string;
};

export type MeteoState = {
  meteoNascer: string;
  meteoPor: string;
  meteoMin: string;
  meteoMax: string;
  meteoChuva: string;
  meteoDescricao: string;
  observacoesGerais: string;
  observacaoCronogramaElenco: string;
  observacaoPlanoSimples: string;
};
