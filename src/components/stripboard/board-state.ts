import type { BoardState, ContainerId, StripItem } from "./types";

export function findContainer(board: BoardState, sceneId: string): ContainerId | undefined {
  if (board.boneyard.some((item) => item.sceneId === sceneId)) return "boneyard";

  for (const day of board.days) {
    if (day.manha.some((item) => item.sceneId === sceneId)) return `day:${day.id}:MANHA`;
    if (day.tarde.some((item) => item.sceneId === sceneId)) return `day:${day.id}:TARDE`;
  }

  return undefined;
}

export function isContainerId(id: string): id is ContainerId {
  return id === "boneyard" || id.startsWith("day:");
}

export function getItems(board: BoardState, container: ContainerId): StripItem[] {
  if (container === "boneyard") return board.boneyard;

  const [, dayId, bloco] = container.split(":");
  const day = board.days.find((d) => d.id === dayId);
  if (!day) return [];
  return bloco === "MANHA" ? day.manha : day.tarde;
}

export function setItems(board: BoardState, container: ContainerId, items: StripItem[]): BoardState {
  if (container === "boneyard") return { ...board, boneyard: items };

  const [, dayId, bloco] = container.split(":");
  return {
    ...board,
    days: board.days.map((day) =>
      day.id === dayId ? { ...day, [bloco === "MANHA" ? "manha" : "tarde"]: items } : day
    ),
  };
}

export type StripboardChangePayload = {
  sceneId: string;
  shootDayId: string | null;
  bloco: "MANHA" | "TARDE" | null;
  ordem: number;
  prepMin: number | null;
  rodMin: number | null;
};

/** Serializa o conteúdo atual de um conjunto de containers em mudanças para persistir via API. */
export function computeChanges(
  board: BoardState,
  containers: ContainerId[]
): StripboardChangePayload[] {
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

    const [, dayId, bloco] = container.split(":");
    const day = board.days.find((d) => d.id === dayId)!;
    const baseOrdem = bloco === "TARDE" ? day.manha.length : 0;

    items.forEach((item, index) => {
      changes.push({
        sceneId: item.sceneId,
        shootDayId: dayId,
        bloco: bloco as "MANHA" | "TARDE",
        ordem: baseOrdem + index,
        prepMin: item.prepMin,
        rodMin: item.rodMin,
      });
    });
  }

  return changes;
}
