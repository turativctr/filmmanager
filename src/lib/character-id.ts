/**
 * O mercado usa dois padrões pra identificar personagem nos documentos de produção: ID curto
 * (Movie Magic/americano — "PRO", "CHEF") ou numeração sequencial (padrão BR/europeu — "1", "2").
 * `Project.sistemaIdElenco` escolhe qual; esta função é o único lugar que decide isso, pra nunca
 * duplicar a lógica em cada documento.
 */

export type CharacterIdInput = { idCurto: string; numeroElenco: number | null };
export type ProjectIdSystemInput = { sistemaIdElenco: "ID_CURTO" | "NUMERACAO" };

export function getCharacterId(character: CharacterIdInput, project: ProjectIdSystemInput): string {
  if (project.sistemaIdElenco === "NUMERACAO" && character.numeroElenco != null) {
    return String(character.numeroElenco);
  }
  return character.idCurto;
}

export type CastLegendEntry = { id: string; personagem: string };

/** null quando o projeto usa ID_CURTO — o personagem já aparece por extenso, legenda não se aplica. */
export function buildCastLegend(
  characters: (CharacterIdInput & { personagem: string })[],
  project: ProjectIdSystemInput
): CastLegendEntry[] | null {
  if (project.sistemaIdElenco !== "NUMERACAO") return null;
  return characters
    .map((c) => ({ id: getCharacterId(c, project), personagem: c.personagem }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}
