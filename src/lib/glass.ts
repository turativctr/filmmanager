// Regra do glassmorphism seletivo: aplica em containers (poucos por tela) — sidebar, header,
// cards de projeto, drawers, modais, seções de dashboard. NUNCA em itens de lista repetidos
// (tiras do Stripboard, linhas de tabela/plano/line item, células do calendário) — backdrop-filter
// é caro, dezenas de elementos com blur simultâneo trava, especialmente em drag-and-drop no iPad.
// Exceção obrigatória: o layout (set-mode) não usa nada deste arquivo — fundo sólido sempre.
export const GLASS_PANEL = "bg-white/70 backdrop-blur-md border border-white/50";
export const GLASS_PANEL_ROUNDED = `${GLASS_PANEL} rounded-2xl`;

/** Botão secundário — glass mais sutil que os containers grandes. */
export const GLASS_SUBTLE = "bg-white/60 backdrop-blur-sm border border-white/60";
