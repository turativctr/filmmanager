import { almocoMarkerId, cenasDoDia, dayItemId } from "./types";
import type { BoardState, ContainerId, DayItem, DayState, StripItem } from "./types";

/** Container de uma tira de cena OU de um bloco de tempo (id "bloco:..."). */
export function findContainer(board: BoardState, itemId: string): ContainerId | undefined {
  if (board.boneyard.some((item) => item.itemId === itemId)) return "boneyard";

  for (const day of board.days) {
    if (day.itens.some((item) => dayItemId(item) === itemId)) return `day:${day.id}`;
  }

  return undefined;
}

export function isContainerId(id: string): id is ContainerId {
  return id === "boneyard" || id.startsWith("day:");
}

/** Só as tiras de cena do container (blocos de tempo ficam de fora). */
export function getItems(board: BoardState, container: ContainerId): StripItem[] {
  if (container === "boneyard") return board.boneyard;

  const dayId = container.split(":")[1];
  const day = board.days.find((d) => d.id === dayId);
  return day ? cenasDoDia(day) : [];
}

/** Uma entrada da lista sortable exibida de um dia — cenas, blocos de tempo e o marcador de almoço
 *  compartilham a mesma lista/SortableContext (ver StripDropZone em shoot-day-column.tsx), então
 *  qualquer drag dentro do dia é tratado como reordenar esta lista combinada, depois convertida de
 *  volta em (itens, almocoIndex) por splitDayEntries. */
export type DayEntry = { type: "item"; item: DayItem } | { type: "almoco" };

export function buildDayEntries(day: DayState): DayEntry[] {
  const entries: DayEntry[] = day.itens.map((item) => ({ type: "item", item }));
  entries.splice(day.almocoIndex, 0, { type: "almoco" });
  return entries;
}

export function dayEntryId(dayId: string, entry: DayEntry): string {
  return entry.type === "item" ? dayItemId(entry.item) : almocoMarkerId(dayId);
}

export function dayEntryIds(day: DayState): string[] {
  return buildDayEntries(day).map((entry) => dayEntryId(day.id, entry));
}

export function splitDayEntries(entries: DayEntry[]): { itens: DayItem[]; almocoIndex: number } {
  const itens: DayItem[] = [];
  let almocoIndex = entries.length - 1;
  for (const entry of entries) {
    if (entry.type === "almoco") almocoIndex = itens.length;
    else itens.push(entry.item);
  }
  return { itens, almocoIndex };
}

export type StripboardChangePayload = {
  sceneId: string;
  scenePartId: string | null;
  shootDayId: string | null;
  bloco: "MANHA" | "TARDE" | null;
  ordem: number;
  prepMin: number | null;
  rodMin: number | null;
  rodDigitado: boolean;
};

export type StripboardBlocoChangePayload = { id: string; shootDayId: string; ordem: number; bloco: "MANHA" | "TARDE" };

/** Serializa o conteúdo atual de um conjunto de containers em mudanças para persistir via API —
 *  bloco nunca é lido de um estado próprio: é sempre derivado da posição do item em relação ao
 *  almocoIndex do dia (índice < almocoIndex = manhã, consequência da posição do marcador). `ordem` é a
 *  posição na lista do dia, compartilhada entre cenas e blocos de tempo. */
export function computeChanges(
  board: BoardState,
  containers: ContainerId[]
): { changes: StripboardChangePayload[]; blocos: StripboardBlocoChangePayload[] } {
  const changes: StripboardChangePayload[] = [];
  const blocos: StripboardBlocoChangePayload[] = [];

  for (const container of containers) {
    if (container === "boneyard") {
      board.boneyard.forEach((item, index) => {
        changes.push({
          sceneId: item.sceneId,
          scenePartId: item.scenePartId,
          shootDayId: null,
          bloco: null,
          ordem: index,
          prepMin: null,
          rodMin: null,
          rodDigitado: false,
        });
      });
      continue;
    }

    const dayId = container.split(":")[1];
    const day = board.days.find((d) => d.id === dayId)!;

    day.itens.forEach((entry, index) => {
      const bloco = index < day.almocoIndex ? "MANHA" : "TARDE";
      if (entry.tipo === "bloco") {
        blocos.push({ id: entry.bloco.id, shootDayId: dayId, ordem: index, bloco });
        return;
      }
      changes.push({
        sceneId: entry.item.sceneId,
        scenePartId: entry.item.scenePartId,
        shootDayId: dayId,
        bloco,
        ordem: index,
        prepMin: entry.item.prepMin,
        rodMin: entry.item.rodMin,
        rodDigitado: entry.item.rodDigitado,
      });
    });
  }

  return { changes, blocos };
}
