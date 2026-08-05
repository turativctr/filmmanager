import type { Tema } from "@prisma/client";

/** Nome do cookie que guarda o tema — além do banco (User.tema), pra o servidor saber o tema já
 *  na primeira renderização (sem cookie, a tela piscaria no tema errado até corrigir). Ver
 *  resolução de tema em src/app/layout.tsx. */
export const THEME_COOKIE_NAME = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

// Onda 3 — PARTE 3: CLARO virou DOCUMENTARIO (nome de gênero, como todo o resto — "claro" era o
// único sem nome de gênero; ver enum Tema no schema.prisma e a migration RENAME VALUE).
// Onda 4: EXPERIMENTAL virou FUTURISTA (o conceito visual virou neon noir — "experimental" não
// descrevia mais nada, mesmo mecanismo de rename).
export const TEMA_VALUES = [
  "DOCUMENTARIO",
  "NOIR",
  "COMEDIA",
  "HISTORICO",
  "HORROR",
  "DRAMA",
  "TELENOVELA",
  "FUTURISTA",
  "FANTASIA",
  "THRILLER",
] as const;

export const TEMA_LABEL: Record<Tema, string> = {
  DOCUMENTARIO: "Documentário",
  NOIR: "Noir",
  COMEDIA: "Comédia",
  HISTORICO: "Histórico",
  HORROR: "Horror",
  DRAMA: "Drama",
  TELENOVELA: "Telenovela",
  FUTURISTA: "Futurista",
  FANTASIA: "Fantasia",
  THRILLER: "Thriller",
};

/** Amostra pro seletor no menu do usuário (ver theme-selector.tsx). Onda 3 — PARTE 4: cada cartão
 *  mostra 4 cores, não 1 — a v1 mostrava só o accent de Planejamento, que é azul em quase todo
 *  tema, então 8 dos 10 cartões pareciam iguais (a amostra escolheu justo a cor que menos varia).
 *  `characteristic` é a cor que de fato comunica o gênero: pra Horror/Thriller/Futurista é a cor
 *  do CROMO (--chrome-border em globals.css — sidebar/header, onde a identidade mora, ver PARTE 2
 *  da onda 3), pra Fantasia é o --chrome-bg (roxo saturado — o tema não tem --chrome-border
 *  próprio, mas a área grande da sidebar/header já é a cor característica), pros demais é o
 *  próprio pageBg (que já é a cor de fundo do cartão — por isso esses chips levam borda, senão
 *  ficariam invisíveis por cima do próprio fundo). `text` é o mesmo --text de cada tema (já
 *  verificado ≥4.5:1 contra o pageBg em globals.css) — usado pro rótulo do card.
 *
 *  Onda 4 — "identidade real": os valores de planejamento/orcamento/erro foram recalculados junto
 *  com a paleta de módulo de cada tema (ver globals.css) — antes eram quase o mesmo azul/verde/
 *  vermelho em 8 dos 10 temas, o diagnóstico exato desta onda. Agora cada tema tem sua própria
 *  execução (temperatura/saturação) da mesma função de cor. EXPERIMENTAL renomeado pra
 *  FUTURISTA (ver TEMA_LABEL acima). */
export const TEMA_SWATCH: Record<
  Tema,
  { pageBg: string; characteristic: string; planejamento: string; orcamento: string; erro: string; text: string }
> = {
  DOCUMENTARIO: {
    pageBg: "#FFFFFF",
    characteristic: "#FFFFFF",
    planejamento: "#185FA5",
    orcamento: "#3B6D11",
    erro: "#A32D2D",
    text: "#09090B",
  },
  NOIR: {
    pageBg: "#0A0A0A",
    characteristic: "#0A0A0A",
    planejamento: "#6B7684",
    orcamento: "#8C9684",
    erro: "#C08C86",
    text: "#D4D4D4",
  },
  COMEDIA: {
    pageBg: "#FFF8E7",
    characteristic: "#FFF8E7",
    planejamento: "#1B8FE0",
    orcamento: "#46C25A",
    erro: "#FF4D4D",
    text: "#2E2A24",
  },
  HISTORICO: {
    pageBg: "#D9C4A3",
    characteristic: "#D9C4A3",
    planejamento: "#4A5A2B",
    orcamento: "#6B7A2E",
    erro: "#C55A3A",
    text: "#2B1D12",
  },
  HORROR: {
    pageBg: "#0A0505",
    characteristic: "#8B1A1A",
    planejamento: "#8FA3B5",
    orcamento: "#8FA882",
    erro: "#FF2020",
    text: "#F5E0DC",
  },
  DRAMA: {
    pageBg: "#C4D6D4",
    characteristic: "#C4D6D4",
    planejamento: "#0F4C6B",
    orcamento: "#1F6B4F",
    erro: "#A32E28",
    text: "#12262B",
  },
  TELENOVELA: {
    pageBg: "#FFF4E0",
    characteristic: "#FFF4E0",
    planejamento: "#0066CC",
    orcamento: "#00A03C",
    erro: "#D32F2F",
    text: "#3A2A14",
  },
  FUTURISTA: {
    pageBg: "#0A0614",
    characteristic: "#00D9FF",
    planejamento: "#00D9FF",
    orcamento: "#00FFA3",
    erro: "#FF3355",
    text: "#E8E0FF",
  },
  FANTASIA: {
    pageBg: "#2A1A4D",
    characteristic: "#4A2E80",
    planejamento: "#6B9BFF",
    orcamento: "#4FD98A",
    erro: "#FF6B8A",
    text: "#F0E8FF",
  },
  THRILLER: {
    pageBg: "#0A0A08",
    characteristic: "#FFE500",
    planejamento: "#4A9EFF",
    orcamento: "#5FD46E",
    erro: "#FF2D20",
    text: "#FFF8DC",
  },
};

export function isValidTema(value: string): value is Tema {
  return (TEMA_VALUES as readonly string[]).includes(value);
}

/** Evento disparado sempre que o tema muda no cliente (ver applyTheme em use-theme.ts) — permite
 *  que componentes como PageBackground reajam na hora, sem precisar de um Context Provider global
 *  só pra isso. */
export const THEME_CHANGE_EVENT = "filmmanager:theme-change";
