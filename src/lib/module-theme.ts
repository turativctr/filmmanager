export type ModuleKey = "scheduling" | "budgeting" | "drafts";

export const MODULE_LABEL: Record<ModuleKey, string> = {
  scheduling: "Planejamento",
  budgeting: "Orçamento",
  drafts: "Roteiro",
};

/** Classes literais (não interpoladas) — o scanner do Tailwind só detecta strings completas no
 *  código-fonte, então cada variante precisa aparecer por extenso aqui, nunca via template
 *  string tipo `bg-${modulo}-bg`. */
export const MODULE_BADGE_CLASS: Record<ModuleKey, string> = {
  scheduling: "bg-scheduling-bg text-scheduling-fg border border-scheduling-accent/30",
  budgeting: "bg-budgeting-bg text-budgeting-fg border border-budgeting-accent/30",
  drafts: "bg-drafts-bg text-drafts-fg border border-drafts-accent/30",
};

/** Item de navegação ativo na sidebar: fundo do módulo + borda esquerda 3px na cor accent. */
export const MODULE_ACTIVE_ITEM_CLASS: Record<ModuleKey, string> = {
  scheduling: "bg-scheduling-bg text-scheduling-fg border-l-[3px] border-l-scheduling-accent",
  budgeting: "bg-budgeting-bg text-budgeting-fg border-l-[3px] border-l-budgeting-accent",
  drafts: "bg-drafts-bg text-drafts-fg border-l-[3px] border-l-drafts-accent",
};

/** Hex cru pro accent de cada módulo — usado só nos orbs decorativos do fundo de página, via
 *  inline style (background-color dinâmico não passa pelo scanner do Tailwind, então aqui pode
 *  ser interpolado sem problema). */
export const MODULE_ACCENT_HEX: Record<ModuleKey, string> = {
  scheduling: "#185FA5",
  budgeting: "#3B6D11",
  drafts: "#534AB7",
};

/** Deriva o módulo ativo a partir do pathname — mesma lógica que Header/Sidebar/PageBackground
 *  usam pra ficar consistentes entre si. null quando a rota não está dentro de um módulo (ex.:
 *  /projects, a lista de projetos). */
export function getActiveModule(pathname: string | null | undefined): ModuleKey | null {
  if (!pathname) return null;
  if (pathname.includes("/budget/") || pathname.endsWith("/budget")) return "budgeting";
  if (pathname.includes("/drafts")) return "drafts";
  if (pathname.includes("/projects/") && pathname.split("/projects/")[1]?.includes("/")) return "scheduling";
  // /projects/[id] (Visão Geral) sem sub-rota ainda conta como Scheduling.
  if (/^\/projects\/[^/]+$/.test(pathname)) return "scheduling";
  return null;
}
