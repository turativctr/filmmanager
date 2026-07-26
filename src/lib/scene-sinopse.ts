/** Sinopse operacional curta da cena — usada na Escaleta do AD e no Hora a Hora. Se `sinopseAD`
 *  não foi preenchida pelo AD, cai pra sinopse do roteiro truncada em 80 chars + reticências. */
export function resolveSinopseAD(scene: { sinopseAD?: string | null; sinopse?: string | null }): string {
  const ad = scene.sinopseAD?.trim();
  if (ad) return ad;

  const original = scene.sinopse?.trim();
  if (!original) return "";

  return original.length > 80 ? `${original.slice(0, 80)}…` : original;
}
