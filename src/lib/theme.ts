import type { Tema } from "@prisma/client";

/** Nome do cookie que guarda o tema — além do banco (User.tema), pra o servidor saber o tema já
 *  na primeira renderização (sem cookie, a tela piscaria no tema errado até corrigir). Ver
 *  resolução de tema em src/app/layout.tsx. */
export const THEME_COOKIE_NAME = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

// Onda 3 — PARTE 3: CLARO virou DOCUMENTARIO (nome de gênero, como todo o resto — "claro" era o
// único sem nome de gênero; ver enum Tema no schema.prisma e a migration RENAME VALUE).
export const TEMA_VALUES = [
  "DOCUMENTARIO",
  "NOIR",
  "COMEDIA",
  "HISTORICO",
  "HORROR",
  "DRAMA",
  "TELENOVELA",
  "EXPERIMENTAL",
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
  EXPERIMENTAL: "Experimental",
  FANTASIA: "Fantasia",
  THRILLER: "Thriller",
};

/** Amostra pro seletor no menu do usuário (ver theme-selector.tsx). Onda 3 — PARTE 4: cada cartão
 *  mostra 4 cores, não 1 — a v1 mostrava só o accent de Planejamento, que é azul em quase todo
 *  tema, então 8 dos 10 cartões pareciam iguais (a amostra escolheu justo a cor que menos varia).
 *  `characteristic` é a cor que de fato comunica o gênero: pra Horror/Thriller é a cor do CROMO
 *  (--chrome-border em globals.css — sidebar/header, onde a identidade mora, ver PARTE 2), pra
 *  Experimental é o ciano (Decupagem, já que o tema não tem cromo próprio), pros demais é o
 *  próprio pageBg (que já é a cor de fundo do cartão — por isso esses chips levam borda, senão
 *  ficariam invisíveis por cima do próprio fundo). `text` é o mesmo --text de cada tema (já
 *  verificado ≥4.5:1 contra o pageBg em globals.css) — usado pro rótulo do card. */
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
    pageBg: "#FFFCF5",
    characteristic: "#FFFCF5",
    planejamento: "#3B8FD9",
    orcamento: "#5FB84A",
    erro: "#EF5B5B",
    text: "#2E2A24",
  },
  HISTORICO: {
    pageBg: "#E4D5BE",
    characteristic: "#E4D5BE",
    planejamento: "#4F5A48",
    orcamento: "#6B7333",
    erro: "#8E2E1C",
    text: "#2A211A",
  },
  HORROR: {
    pageBg: "#120808",
    characteristic: "#6B1F1F",
    planejamento: "#7E96A8",
    orcamento: "#849A78",
    erro: "#FF5545",
    text: "#F0DDD8",
  },
  DRAMA: {
    pageBg: "#D5E3E2",
    characteristic: "#D5E3E2",
    planejamento: "#1F5F7E",
    orcamento: "#2E7A5E",
    erro: "#A83E3A",
    text: "#1B2E30",
  },
  TELENOVELA: {
    pageBg: "#FFFDF8",
    characteristic: "#FFFDF8",
    planejamento: "#0F6FC4",
    orcamento: "#2E9E3F",
    erro: "#E01E2E",
    text: "#3A2E1C",
  },
  EXPERIMENTAL: {
    pageBg: "#080B14",
    characteristic: "#00F0D0",
    planejamento: "#00D4FF",
    orcamento: "#00E5A0",
    erro: "#FF3366",
    text: "#D8E4F0",
  },
  FANTASIA: {
    pageBg: "#F2EDFA",
    characteristic: "#F2EDFA",
    planejamento: "#4A6FC4",
    orcamento: "#3F8F63",
    erro: "#C4485C",
    text: "#3A2E4A",
  },
  THRILLER: {
    pageBg: "#14120A",
    characteristic: "#FFD400",
    planejamento: "#4A9EFF",
    orcamento: "#5FD46E",
    erro: "#FF3B30",
    text: "#F0E8D0",
  },
};

export function isValidTema(value: string): value is Tema {
  return (TEMA_VALUES as readonly string[]).includes(value);
}

/** Evento disparado sempre que o tema muda no cliente (ver applyTheme em use-theme.ts) — permite
 *  que componentes como PageBackground reajam na hora, sem precisar de um Context Provider global
 *  só pra isso. */
export const THEME_CHANGE_EVENT = "filmmanager:theme-change";
