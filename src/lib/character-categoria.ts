import type { CharacterCategoria } from "@prisma/client";

export const CHARACTER_CATEGORIA_LABEL: Record<CharacterCategoria, string> = {
  PRINCIPAL: "Principal",
  COADJUVANTE: "Coadjuvante",
  PARTICIPACAO_ESPECIAL: "Participação Especial",
  FIGURACAO: "Figuração",
  VOZ_OFF: "Voz Off",
  DUPLO: "Duplo",
  OUTRO: "Outro",
};

/** Ordem de prioridade usada pra agrupar/ordenar elenco por categoria (DOOD, Prestação de Contas). */
export const CHARACTER_CATEGORIA_ORDER: CharacterCategoria[] = [
  "PRINCIPAL",
  "COADJUVANTE",
  "PARTICIPACAO_ESPECIAL",
  "FIGURACAO",
  "VOZ_OFF",
  "DUPLO",
  "OUTRO",
];

export const CHARACTER_CATEGORIA_BADGE_CLASS: Record<CharacterCategoria, string> = {
  PRINCIPAL: "border-blue-400/50 bg-blue-100 text-blue-700",
  COADJUVANTE: "border-green-400/50 bg-green-100 text-green-700",
  PARTICIPACAO_ESPECIAL: "border-purple-400/50 bg-purple-100 text-purple-700",
  FIGURACAO: "border-gray-400/50 bg-gray-200 text-gray-700",
  VOZ_OFF: "border-amber-400/50 bg-amber-100 text-amber-700",
  DUPLO: "border-orange-400/50 bg-orange-100 text-orange-700",
  OUTRO: "border-gray-300/50 bg-gray-100 text-gray-500",
};
