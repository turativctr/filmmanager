/**
 * Compara identificadores alfanuméricos de cena (ex.: "5", "8", "8PL", "9", "10", "14A")
 * na ordem que um roteirista esperaria, em vez da ordem lexicográfica pura.
 */
export function naturalCompare(a: string, b: string): number {
  const chunksA = a.match(/\d+|\D+/g) ?? [a];
  const chunksB = b.match(/\d+|\D+/g) ?? [b];
  const length = Math.max(chunksA.length, chunksB.length);

  for (let i = 0; i < length; i++) {
    const chunkA = chunksA[i] ?? "";
    const chunkB = chunksB[i] ?? "";
    if (chunkA === chunkB) continue;

    const numA = Number(chunkA);
    const numB = Number(chunkB);
    const bothNumeric = !Number.isNaN(numA) && !Number.isNaN(numB);

    if (bothNumeric) {
      if (numA !== numB) return numA - numB;
    } else {
      return chunkA.localeCompare(chunkB);
    }
  }

  return 0;
}
