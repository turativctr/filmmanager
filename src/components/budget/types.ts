export type AccountGroupType = "ATL" | "BTL_PRODUCAO" | "BTL_POS" | "OUTROS";
export type FringeType = "INSS" | "FGTS" | "ISS" | "OUTRO";

export type LineItemData = {
  id: string;
  accountId: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  periodo: number;
  taxa: number;
  moeda: string;
  taxaCambio: number;
  total: number;
  isFrengeable: boolean;
  globalRef: string | null;
  ordem: number;
};

export type ActualData = {
  id: string;
  accountId: string;
  descricao: string;
  valor: number;
  data: string;
  notas: string | null;
};

export type AccountData = {
  id: string;
  groupId: string;
  codigo: string;
  nome: string;
  ordem: number;
  lineItems: LineItemData[];
  actuals: ActualData[];
};

export type AccountGroupData = {
  id: string;
  codigo: string;
  nome: string;
  tipo: AccountGroupType;
  ordem: number;
  accounts: AccountData[];
};

export type GlobalData = {
  id: string;
  chave: string;
  valor: number;
  descricao: string | null;
  afetaLinhas: string[];
};

export type FringeLineItemData = {
  id: string;
  accountId: string | null;
  base: number;
  valor: number;
};

export type FringeData = {
  id: string;
  nome: string;
  percentual: number;
  teto: number | null;
  aplicaEm: string[];
  tipo: FringeType;
  fringeLineItems: FringeLineItemData[];
};

export type ScenarioOverrideData = {
  id: string;
  chave: string;
  valor: number;
};

export type ScenarioData = {
  id: string;
  nome: string;
  notas: string | null;
  isBase: boolean;
  overrides: ScenarioOverrideData[];
};

export type BudgetData = {
  id: string;
  moedaBase: string;
  versao: string;
  contingenciaPercentual: number;
  notas: string | null;
  accountGroups: AccountGroupData[];
  globals: GlobalData[];
  fringes: FringeData[];
  scenarios: ScenarioData[];
};

export const ACCOUNT_GROUP_TYPE_LABEL: Record<AccountGroupType, string> = {
  ATL: "ATL",
  BTL_PRODUCAO: "BTL — Produção",
  BTL_POS: "BTL — Pós-produção",
  OUTROS: "Outros",
};

export const FRINGE_TYPE_LABEL: Record<FringeType, string> = {
  INSS: "INSS",
  FGTS: "FGTS",
  ISS: "ISS",
  OUTRO: "Outro",
};
