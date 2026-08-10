export function idCurtoFrom(name: string): string {
  const letters = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return (letters.slice(0, 3) || "PER").toUpperCase();
}
