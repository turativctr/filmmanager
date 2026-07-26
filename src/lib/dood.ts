import { timeToMinutes } from "@/lib/schedule";

export type DoodStatus = "SW" | "W" | "WF" | "SW_WF" | "H" | "—";

export const DOOD_STATUS_LABEL: Record<DoodStatus, string> = {
  SW: "SW",
  W: "W",
  WF: "WF",
  SW_WF: "SW/WF",
  H: "H",
  "—": "—",
};

const WORKING_STATUSES: DoodStatus[] = ["SW", "W", "WF", "SW_WF"];

export function isWorkingStatus(status: DoodStatus): boolean {
  return (WORKING_STATUSES as string[]).includes(status);
}

/** SW no primeiro dia trabalhado, WF no último, W nos do meio, H nos dias contratados sem cena, — fora do intervalo. */
export function computeStatusRow(workingShootDayIds: string[], shootDayIds: string[]): DoodStatus[] {
  const working = new Set(workingShootDayIds);
  const workingIndices = shootDayIds
    .map((id, index) => (working.has(id) ? index : -1))
    .filter((index) => index !== -1);

  if (workingIndices.length === 0) return shootDayIds.map(() => "—");

  const first = Math.min(...workingIndices);
  const last = Math.max(...workingIndices);

  return shootDayIds.map((id, index) => {
    if (index < first || index > last) return "—";
    if (working.has(id)) {
      if (index === first && index === last) return "SW_WF";
      if (index === first) return "SW";
      if (index === last) return "WF";
      return "W";
    }
    return "H";
  });
}

export type DoodShootDayInput = {
  id: string;
  numeroDia: number;
  data: string;
  blocoManhaInicio: string | null;
  almocoInicio: string | null;
};

export type DoodCharacterInput = {
  id: string;
  idCurto: string;
  numeroElenco: number | null;
  personagem: string;
  workingShootDayIds: string[];
  callTimes: Record<string, { chamada: string | null; saida: string | null }>;
};

export type DoodExtraInput = {
  id: string;
  personagem: string;
  quantidade: number;
  workingShootDayIds: string[];
};

export type DoodCharacterRow = {
  id: string;
  idCurto: string;
  numeroElenco: number | null;
  personagem: string;
  cells: DoodStatus[];
  totalW: number;
  totalH: number;
  totalContracted: number;
};

export type DoodExtraRow = {
  id: string;
  personagem: string;
  quantidade: number;
  cells: DoodStatus[];
};

export type DoodDayTotals = {
  shootDayId: string;
  totalElenco: number;
  totalFiguracao: number;
};

export type DoodMeals = {
  shootDayId: string;
  totalPessoas: number;
  cafeDaManha: number;
  almoco: number;
};

export function computeDood(
  shootDays: DoodShootDayInput[],
  characters: DoodCharacterInput[],
  extras: DoodExtraInput[],
  equipeTecnica: number
) {
  const shootDayIds = shootDays.map((d) => d.id);

  const characterRows: DoodCharacterRow[] = characters.map((character) => {
    const cells = computeStatusRow(character.workingShootDayIds, shootDayIds);
    const totalW = cells.filter(isWorkingStatus).length;
    const totalH = cells.filter((c) => c === "H").length;
    return {
      id: character.id,
      idCurto: character.idCurto,
      numeroElenco: character.numeroElenco,
      personagem: character.personagem,
      cells,
      totalW,
      totalH,
      totalContracted: totalW + totalH,
    };
  });

  const extraRows: DoodExtraRow[] = extras.map((extra) => ({
    id: extra.id,
    personagem: extra.personagem,
    quantidade: extra.quantidade,
    cells: computeStatusRow(extra.workingShootDayIds, shootDayIds),
  }));

  const totalsByDay: DoodDayTotals[] = shootDayIds.map((shootDayId, index) => ({
    shootDayId,
    totalElenco: characterRows.filter((row) => isWorkingStatus(row.cells[index])).length,
    totalFiguracao: extraRows
      .filter((row) => isWorkingStatus(row.cells[index]))
      .reduce((sum, row) => sum + row.quantidade, 0),
  }));

  const mealsByDay: DoodMeals[] = shootDays.map((day, index) => {
    const manhaStart = day.blocoManhaInicio ? timeToMinutes(day.blocoManhaInicio) : null;
    const almocoStart = day.almocoInicio ? timeToMinutes(day.almocoInicio) : null;

    const presentCharacters = characters.filter((c) => isWorkingStatus(characterRows.find((r) => r.id === c.id)!.cells[index]));

    const cafeCharacters = presentCharacters.filter((c) => {
      const callTime = c.callTimes[day.id];
      if (!callTime?.chamada || manhaStart === null) return true;
      return timeToMinutes(callTime.chamada) <= manhaStart;
    }).length;

    const almocoCharacters = presentCharacters.filter((c) => {
      const callTime = c.callTimes[day.id];
      if (!callTime?.saida || almocoStart === null) return true;
      return timeToMinutes(callTime.saida) > almocoStart;
    }).length;

    const figuracaoCount = totalsByDay[index].totalFiguracao;

    return {
      shootDayId: day.id,
      totalPessoas: presentCharacters.length + figuracaoCount + equipeTecnica,
      cafeDaManha: cafeCharacters + figuracaoCount + equipeTecnica,
      almoco: almocoCharacters + figuracaoCount + equipeTecnica,
    };
  });

  return { characterRows, extraRows, totalsByDay, mealsByDay };
}
