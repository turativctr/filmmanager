import type { Line, RawItem } from "./pdf-script-types";

// Tolerância pra agrupar itens de texto na MESMA linha visual — maior que a usada pro
// agrupamento de margem em X (CLUSTER_TOLERANCE_PT=5 em pdf-script-parser.ts, um eixo
// diferente). Acentos (ã, ç, é...) e fontes mistas numa mesma linha podem render alguns décimos
// de ponto fora do baseline principal; arredondar pra uma grade fixa de 0.5pt (como era antes)
// separa esses glifos em "linhas" próprias — texto em português, cheio de acento, é o caso mais
// afetado. 3pt absorve esse ruído sem risco de fundir duas linhas reais (espaçamento padrão de
// roteiro é 12pt).
const LINE_Y_TOLERANCE_PT = 3;

type PositionedItem = RawItem & { y: number };

/** Agrupa itens de texto já posicionados (x0/x1/y) em linhas — dois itens pertencem à mesma
 *  linha se o Y deles está a até LINE_Y_TOLERANCE_PT de distância do PRIMEIRO item do grupo (não
 *  do último, pra não deixar o baseline "derivar" ao longo de uma linha com muitos itens). */
export function groupItemsIntoLines(items: PositionedItem[], pageNumber: number): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x0 - b.x0);
  const groups: { refY: number; items: PositionedItem[] }[] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.refY - item.y <= LINE_Y_TOLERANCE_PT) {
      last.items.push(item);
    } else {
      groups.push({ refY: item.y, items: [item] });
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
