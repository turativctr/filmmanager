/** Red flags: mesmo personagem escalado em duas cenas com horários de rodagem sobrepostos no mesmo dia. */

export type SceneConflictInput = {
  sceneId: string;
  numero: string;
  characterIds: string[];
  rodStartMin: number;
  rodEndMin: number;
};

export function detectSceneConflicts(
  scenes: SceneConflictInput[],
  characterLabel: (characterId: string) => string
): Map<string, string[]> {
  const conflicts = new Map<string, string[]>();

  function addConflict(sceneId: string, message: string) {
    conflicts.set(sceneId, [...(conflicts.get(sceneId) ?? []), message]);
  }

  for (let i = 0; i < scenes.length; i++) {
    for (let j = i + 1; j < scenes.length; j++) {
      const a = scenes[i];
      const b = scenes[j];
      const overlaps = a.rodStartMin < b.rodEndMin && b.rodStartMin < a.rodEndMin;
      if (!overlaps) continue;

      const shared = a.characterIds.filter((id) => b.characterIds.includes(id));
      for (const characterId of shared) {
        const label = characterLabel(characterId);
        const message = `${label} está nas cenas ${a.numero} e ${b.numero} com horários sobrepostos.`;
        addConflict(a.sceneId, message);
        addConflict(b.sceneId, message);
      }
    }
  }

  return conflicts;
}
