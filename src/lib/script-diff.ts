/**
 * Motor de diff cena a cena entre o roteiro já salvo no projeto e uma nova versão recém-parseada.
 * Casamento por `numero` (mesma convenção já usada pelo import de FDX em cenas existentes, e
 * consistente com a prática real: o número da cena é o identificador estável entre revisões —
 * uma cena nova insere uma letra (14A), uma removida vira OMITIDA, números não são reciclados).
 *
 * `existingScenes` deve conter só as cenas ATIVAS (não omitidas) do projeto — uma cena já
 * marcada omitida em um draft anterior não deve ser re-diagnosticada como "removida de novo"
 * caso ainda esteja ausente, nem começar a comparar campos contra um estado que não é mais o
 * vigente. Se o número de uma cena omitida reaparecer numa nova versão, o motor a trata como
 * "adicionada" (do ponto de vista de quem só vê cenas ativas) — cabe a quem aplica o diff decidir
 * se isso deve reativar a cena existente ou criar uma nova linha.
 */
import { diffWords } from "diff";

import type { FdxScene } from "@/lib/fdx-parser";

export type ExistingSceneForDiff = {
  numero: string;
  tipo: FdxScene["tipo"];
  periodo: FdxScene["periodo"];
  set: string | null;
  sinopse: string | null;
  paginas: number;
  personagens: string[];
};

export type FieldChange = { antes: unknown; depois: unknown };

export type SceneDiffResult =
  | { tipo: "ADICIONADA"; numero: string; scene: FdxScene }
  | { tipo: "REMOVIDA"; numero: string }
  | { tipo: "MODIFICADA"; numero: string; camposAlterados: Record<string, FieldChange> };

function personagensIguais(a: string[], b: string[]): boolean {
  const setA = new Set(a.map((n) => n.toUpperCase()));
  const setB = new Set(b.map((n) => n.toUpperCase()));
  if (setA.size !== setB.size) return false;
  for (const n of setA) if (!setB.has(n)) return false;
  return true;
}

export function computeSceneDiffs(
  existingScenes: ExistingSceneForDiff[],
  newScenes: FdxScene[]
): SceneDiffResult[] {
  const existingByNumero = new Map(existingScenes.map((s) => [s.numero, s]));
  const newByNumero = new Map(newScenes.map((s) => [s.numero, s]));
  const results: SceneDiffResult[] = [];

  for (const newScene of newScenes) {
    const existing = existingByNumero.get(newScene.numero);
    if (!existing) {
      results.push({ tipo: "ADICIONADA", numero: newScene.numero, scene: newScene });
      continue;
    }

    const camposAlterados: Record<string, FieldChange> = {};
    if (existing.tipo !== newScene.tipo) {
      camposAlterados.tipo = { antes: existing.tipo, depois: newScene.tipo };
    }
    if (existing.periodo !== newScene.periodo) {
      camposAlterados.periodo = { antes: existing.periodo, depois: newScene.periodo };
    }
    if ((existing.set ?? null) !== (newScene.set ?? null)) {
      camposAlterados.set = { antes: existing.set, depois: newScene.set };
    }
    if ((existing.sinopse ?? "") !== (newScene.sinopse ?? "")) {
      camposAlterados.sinopse = { antes: existing.sinopse, depois: newScene.sinopse };
    }
    if (Math.abs(existing.paginas - newScene.paginas) > 1e-9) {
      camposAlterados.paginas = { antes: existing.paginas, depois: newScene.paginas };
    }
    if (!personagensIguais(existing.personagens, newScene.personagens)) {
      camposAlterados.personagens = { antes: existing.personagens, depois: newScene.personagens };
    }

    if (Object.keys(camposAlterados).length > 0) {
      results.push({ tipo: "MODIFICADA", numero: newScene.numero, camposAlterados });
    }
  }

  for (const existing of existingScenes) {
    if (!newByNumero.has(existing.numero)) {
      results.push({ tipo: "REMOVIDA", numero: existing.numero });
    }
  }

  return results;
}

export type SinopseWordDiff = { texto: string; tipo: "igual" | "adicionado" | "removido" }[];

/** Diff em nível de palavra do texto da sinopse — o asterisco do FDX marca o parágrafo inteiro,
 *  mas para revisar o que de fato mudou numa frase é mais útil ver as palavras específicas. */
export function diffSinopse(antes: string | null, depois: string | null): SinopseWordDiff {
  return diffWords(antes ?? "", depois ?? "").map((part) => ({
    texto: part.value,
    tipo: part.added ? "adicionado" : part.removed ? "removido" : "igual",
  }));
}
