import { normalize } from "@/lib/shots-shared";

import type { SceneSummary, StripItem } from "./types";

/** Filtro do Boneyard — ferramenta de momento, não persiste. Critérios combinam com E; dentro de
 *  cada critério, as opções marcadas combinam com OU. Critério vazio = não filtra. Parte de cena
 *  dividida herda locação, classeLuz e elenco da cena. */
export type BoneyardFiltro = {
  /** Ids de Locacao; SEM_LOCACAO casa cena sem locação atribuída. */
  locacaoIds: string[];
  classesLuz: SceneSummary["classeLuz"][];
  characterIds: string[];
  /** Casa com o número da cena, o rótulo da parte, o nome da locação e os IDs de elenco da cena
   *  (sem acento, sem caixa) — o ID é o que a AD lê em toda tira ("AKE", "MEI"). */
  busca: string;
};

export const SEM_LOCACAO = "__sem_locacao__";

export const FILTRO_VAZIO: BoneyardFiltro = { locacaoIds: [], classesLuz: [], characterIds: [], busca: "" };

export function filtroAtivo(f: BoneyardFiltro): boolean {
  return f.locacaoIds.length > 0 || f.classesLuz.length > 0 || f.characterIds.length > 0 || f.busca.trim() !== "";
}

export function passaNoFiltro(
  item: StripItem,
  f: BoneyardFiltro,
  /** Id do personagem → ID exibido na tira (AKE, MEI ou o número do elenco). */
  resolveIdElenco: (characterId: string) => string = (id) => id
): boolean {
  const { scene } = item;
  if (f.locacaoIds.length > 0 && !f.locacaoIds.includes(scene.locacaoId ?? SEM_LOCACAO)) return false;
  if (f.classesLuz.length > 0 && !f.classesLuz.includes(scene.classeLuz)) return false;
  if (f.characterIds.length > 0 && !f.characterIds.some((id) => scene.characterIds.includes(id))) return false;
  const busca = normalize(f.busca);
  if (busca) {
    const alvo = [scene.numero, item.parte?.rotulo, scene.locacao, ...scene.characterIds.map(resolveIdElenco)].map(
      normalize
    );
    if (!alvo.some((t) => t.includes(busca))) return false;
  }
  return true;
}
