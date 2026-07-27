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

/** Nome de locação é sempre maiúsculo — convenção de set, é assim que aparece na Ordem do Dia
 *  e nos relatórios impressos. Scene.set NÃO passa por isso: fica com a grafia original do
 *  roteiro, que é o rastro de qual set virou qual locação real. */
export function normalizeLocacaoNome(nome: string): string {
  return nome.trim().toUpperCase();
}

/** Ordena locações alfabeticamente ignorando acento (ex.: "ÁGUA" antes de "ZONA"), pela
 *  convenção pt-BR — não usar orderBy do Postgres aqui porque o banco está em collation "C"
 *  (POSIX), que ordena por byte cru e joga letras acentuadas pro fim. */
export function compareLocacaoNome(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}
