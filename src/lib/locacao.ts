import type { TipoPontoApoio } from "@prisma/client";

export const TIPO_PONTO_APOIO_LABEL: Record<TipoPontoApoio, string> = {
  METRO_TREM: "Metrô/Trem",
  ONIBUS: "Ônibus",
  ESTACIONAMENTO: "Estacionamento",
  MERCADO: "Mercado",
  FARMACIA: "Farmácia",
  RESTAURANTE: "Restaurante",
  POSTO_COMBUSTIVEL: "Posto de combustível",
  OUTRO: "Outro",
};

/** Ordem fixa de exibição dos pontos de apoio agrupados por tipo (Ordem do Dia, detalhe da locação). */
export const TIPO_PONTO_APOIO_ORDER: TipoPontoApoio[] = [
  "METRO_TREM",
  "ONIBUS",
  "ESTACIONAMENTO",
  "MERCADO",
  "FARMACIA",
  "RESTAURANTE",
  "POSTO_COMBUSTIVEL",
  "OUTRO",
];

/** Normaliza um endereço pra comparação de duplicidade: minúsculas, sem pontuação, espaços
 *  colapsados. Usado só pra SUGERIR unificação (nunca unifica sozinho — duas locações podem
 *  legitimamente dividir endereço, ex.: prédio grande, andares diferentes). */
export function normalizeEndereco(endereco: string): string {
  return endereco
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (acentos)
    .replace(/[^\w\s]/g, " ") // pontuação vira espaço
    .replace(/\s+/g, " ")
    .trim();
}
