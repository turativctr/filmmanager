import type { Line, RawItem } from "./pdf-script-types";

// Tolerância pra agrupar itens de texto na MESMA linha visual — maior que a usada pro
// agrupamento de margem em X (CLUSTER_TOLERANCE_PT=5 em pdf-script-parser.ts, um eixo
// diferente). Acentos (ã, ç, é...) e fontes mistas numa mesma linha podem render alguns décimos
// de ponto fora do baseline principal; arredondar pra uma grade fixa de 0.5pt (como era antes)
// separa esses glifos em "linhas" próprias — texto em português, cheio de acento, é o caso mais
// afetado. No máximo 4pt (bem menor que o espaçamento padrão de 12pt de um roteiro) — folgado o
// bastante pra absorver esse ruído, apertado o bastante pra nunca fundir duas linhas reais.
const LINE_Y_TOLERANCE_PT = 3;
// Trava complementar ao Y: mesmo dentro da tolerância de Y, dois itens só entram na MESMA linha
// se o X deles for compatível (perto de outro item já no grupo). Sem isso, um cabeçalho e uma
// coluna de personagem bem abaixo dele (X bem diferente, ex.: 108 e 252) poderiam colar numa
// linha só se caíssem a poucos pontos um do outro em Y por coincidência — são elementos
// DIFERENTES do roteiro, não a mesma linha com um acento fora do baseline.
const X_COMPATIBILITY_GAP_PT = 20;

type PositionedItem = RawItem & { y: number };
type LineGroup = { refY: number; minX0: number; maxX1: number; items: PositionedItem[] };

/** Agrupa itens de texto já posicionados (x0/x1/y) em linhas — dois itens pertencem à mesma
 *  linha se o Y deles está a até LINE_Y_TOLERANCE_PT de distância do PRIMEIRO item do grupo (não
 *  do último, pra não deixar o baseline "derivar" ao longo de uma linha com muitos itens) E o X
 *  for compatível com a faixa [minX0, maxX1] já ocupada pelo grupo (ver X_COMPATIBILITY_GAP_PT). */
export function groupItemsIntoLines(items: PositionedItem[], pageNumber: number): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x0 - b.x0);
  const groups: LineGroup[] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    const yCompatible = !!last && last.refY - item.y <= LINE_Y_TOLERANCE_PT;
    const xCompatible =
      !!last && item.x0 >= last.minX0 - X_COMPATIBILITY_GAP_PT && item.x0 <= last.maxX1 + X_COMPATIBILITY_GAP_PT;
    if (last && yCompatible && xCompatible) {
      last.items.push(item);
      last.minX0 = Math.min(last.minX0, item.x0);
      last.maxX1 = Math.max(last.maxX1, item.x1);
    } else {
      groups.push({ refY: item.y, minX0: item.x0, maxX1: item.x1, items: [item] });
    }
  }

  return groups
    .map((group) => {
      const sortedByX = [...group.items].sort((a, b) => a.x0 - b.x0);
      return {
        page: pageNumber,
        y: group.refY,
        items: sortedByX.map(({ text, x0, x1 }) => ({ text, x0, x1 })),
        text: sortedByX.map((i) => i.text).join("").trim(),
      };
    })
    .filter((line) => line.text.length > 0);
}
