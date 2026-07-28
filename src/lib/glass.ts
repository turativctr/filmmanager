// Regra do glassmorphism seletivo: aplica em containers (poucos por tela) — sidebar, header,
// cards de projeto, drawers, modais, seções de dashboard. NUNCA em itens de lista repetidos
// (tiras do Stripboard, linhas de tabela/plano/line item, células do calendário) — backdrop-filter
// é caro, dezenas de elementos com blur simultâneo trava, especialmente em drag-and-drop no iPad.
// Exceção obrigatória: o layout (set-mode) não usa nada deste arquivo — fundo sólido sempre.
//
// Cor + opacidade vêm de variáveis CSS (--surface/--surface-glass-alpha etc., ver globals.css) —
// cada tema define os próprios valores (ex.: Comédia/Histórico deixam o glass mais opaco porque
// cor suave + glassmorphism juntos derrubam contraste demais). Usa valor arbitrário do Tailwind
// (`bg-[rgb(var(--x)/var(--y))]`) em vez do token `surface` do tailwind.config porque esse token
// é pra uso OPACO (alpha=1); aqui o alpha some da própria variável de tema, não de um modificador
// `/NN` fixo — senão a opacidade não poderia variar por tema com a mesma classe.
// Peças soltas — pra containers com borda só de um lado (sidebar, header: border-r/border-b),
// onde o bundle abaixo (que já inclui a largura `border` nos 4 lados) não serve.
export const GLASS_BG = "bg-[rgb(var(--surface)/var(--surface-glass-alpha))] backdrop-blur-md";
export const GLASS_BORDER_COLOR = "border-[rgb(var(--surface-border)/var(--surface-border-alpha))]";
export const GLASS_HOVER_BG = "hover:bg-[rgb(var(--surface)/var(--surface-glass-subtle-alpha))]";

export const GLASS_PANEL = `${GLASS_BG} border ${GLASS_BORDER_COLOR}`;
export const GLASS_PANEL_ROUNDED = `${GLASS_PANEL} rounded-2xl`;

/** Botão secundário — glass mais sutil que os containers grandes. */
export const GLASS_SUBTLE_BG = "bg-[rgb(var(--surface)/var(--surface-glass-subtle-alpha))] backdrop-blur-sm";
export const GLASS_SUBTLE_BORDER_COLOR =
  "border-[rgb(var(--surface-border)/var(--surface-border-subtle-alpha))]";
export const GLASS_SUBTLE_HOVER_BG = "hover:bg-[rgb(var(--surface)/var(--surface-glass-hover-alpha))]";
export const GLASS_SUBTLE = `${GLASS_SUBTLE_BG} border ${GLASS_SUBTLE_BORDER_COLOR}`;
