/** Pluraliza um substantivo em português dado um contador — "1 diária"/"2 diárias". Sem tentar
 *  cobrir plurais irregulares em geral, só o suficiente pro vocabulário deste app (regra do -s). */
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
