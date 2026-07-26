import { almocoMarkerId } from "./types";
import type { BoardState, ContainerId, DayState, StripItem } from "./types";

export function findContainer(board: BoardState, sceneId: string): ContainerId | undefined {
  if (board.boneyard.some((item) => item.sceneId === sceneId)) return "boneyard";

  for (const day of board.days) {
    if (day.scenes.some((item) => item.sceneId === sceneId)) return `day:${day.id}`;
  }

  return undefined;
}

export function isContainerId(id: string): id is ContainerId {
  return id === "boneyard" || id.startsWith("day:");
}

export function getItems(board: BoardState, container: ContainerId): StripItem[] {
  if (container === "boneyard") return board.boneyard;

  const dayId = container.split(":")[1];
  return board.days.find((d) => d.id === dayId)?.scenes ?? [];
}

export function setItems(board: BoardState, container: ContainerId, items: StripItem[]): BoardState {
  if (container === "boneyard") return { ...board, boneyard: items };

  const dayId = container.split(":")[1];
  return {
    ...board,
    days: board.days.map((day) => (day.id === dayId ? { ...day, scenes: items } : day)),
  };
}

/** Uma entrada da lista sortable exibida de um dia — cenas e o marcador de almoço compartilham a
 *  mesma lista/SortableContext (ver StripDropZone em shoot-day-column.tsx), então qualquer drag
 *  dentro do dia (mover uma cena OU mover o próprio marcador) é tratado como reordenar esta lista
 *  combinada, depois convertida de volta em (scenes, almocoIndex) por splitDayEntries. */
export type DayEntry = { type: "scene"; item: StripItem } | { type: "almoco" };

export function buildDayEntries(day: DayState): DayEntry[] {
  const entries: DayEntry[] = day.scenes.map((item) => ({ type: "scene", item }));
  entries.splice(day.almocoIndex, 0, { type: "almoco" });
  return entries;
}

export function dayEntryIds(day: DayState): string[] {
  return buildDayEntries(day).map((entry) => (entry.type === "scene" ? entry.item.sceneId : almocoMarkerId(day.id)));
}

export function splitDayEntries(entries: DayEntry[]): { scenes: StripItem[]; almocoIndex: number } {
  const scenes: StripItem[] = [];
  let almocoIndex = entries.length - 1;
  for (const entry of entries) {
    if (entry.type === "almoco") almocoIndex = scenes.length;
    else scenes.push(entry.item);
  }
  return { scenes, almocoIndex };
}

export type StripboardChangePayload = {
  sceneId: string;
  shootDayId: string | null;
  bloco: "MANHA" | "TARDE" | null;
  ordem: number;
  prepMin: number | null;
  rodMin: number | null;
};

/** Serializa o conteúdo atual de um conjunto de containers em mudanças para persistir via API —
 *  bloco nunca é lido de um estado próprio: é sempre derivado da posição do item em relação ao
 *  almocoIndex do dia (índice < almocoIndex = manhã, consequência da posição do marcador). */
export function computeChanges(board: BoardState, containers: ContainerId[]): StripboardChangePayload[] {
  const changes: StripboardChangePayload[] = [];

  for (const container of containers) {
    const items = getItems(board, container);

    if (container === "boneyard") {
      items.forEach((item, index) => {
        changes.push({
          sceneId: item.sceneId,
          shootDayId: null,
          bloco: null,
          ordem: index,
          prepMin: null,
          rodMin: null,
        });
      });
      continue;
    }

    const dayId = container.split(":")[1];
    const day = board.days.find((d) => d.id === dayId)!;

    items.forEach((item, index) => {
      changes.push({
        sceneId: item.sceneId,
        shootDayId: dayId,
        bloco: index < day.almocoIndex ? "MANHA" : "TARDE",
        ordem: index,
        prepMin: item.prepMin,
        rodMin: item.rodMin,
      });
    });
  }

  return changes;
}
