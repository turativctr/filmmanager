import type { Tema } from "@prisma/client";

/** Nome do cookie que guarda o tema — além do banco (User.tema), pra o servidor saber o tema já
 *  na primeira renderização (sem cookie, a tela piscaria no tema errado até corrigir). Ver
 *  resolução de tema em src/app/layout.tsx. */
export const THEME_COOKIE_NAME = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

export const TEMA_VALUES = [
  "CLARO",
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
  CLARO: "Claro",
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

/** Amostra de cores pro seletor no menu do usuário — mostra ao lado do nome do tema. Só decorativo,
 *  não precisa refletir TODAS as cores do tema, só dar um preview reconhecível. `text` é o mesmo
 *  --text de cada tema (já verificado ≥4.5:1 contra o próprio pageBg em globals.css) — usado pro
 *  rótulo do card no diálogo de seleção (ver theme-selector.tsx), pra não precisar recalcular
 *  contraste em runtime pra cada cartão com fundo diferente. */
export const TEMA_SWATCH: Record<Tema, { pageBg: string; surface: string; accent: string; text: string }> = {
  CLARO: { pageBg: "#FFFFFF", surface: "#FFFFFF", accent: "#185FA5", text: "#09090B" },
  NOIR: { pageBg: "#0A0A0A", surface: "#16161A", accent: "#6B7684", text: "#D4D4D4" },
  COMEDIA: { pageBg: "#FFFCF5", surface: "#FFFFFF", accent: "#3B8FD9", text: "#2E2A24" },
  HISTORICO: { pageBg: "#EDE3D2", surface: "#F7EFE0", accent: "#61766E", text: "#2E2620" },
  HORROR: { pageBg: "#0F0B0B", surface: "#17100F", accent: "#6E8496", text: "#E8D4D0" },
  DRAMA: { pageBg: "#EEF3F4", surface: "#FFFFFF", accent: "#1F5F7E", text: "#1F3538" },
  TELENOVELA: { pageBg: "#FFFDF8", surface: "#FFFFFF", accent: "#0F6FC4", text: "#3A2E1C" },
  EXPERIMENTAL: { pageBg: "#FFFEF2", surface: "#FFFFFF", accent: "#0057D9", text: "#18181B" },
  FANTASIA: { pageBg: "#1B1435", surface: "#251C42", accent: "#5B9BE8", text: "#E4DCF5" },
  THRILLER: { pageBg: "#0D0D14", surface: "#14141F", accent: "#2E5CFF", text: "#F0E8D8" },
};

export function isValidTema(value: string): value is Tema {
  return (TEMA_VALUES as readonly string[]).includes(value);
}

/** Evento disparado sempre que o tema muda no cliente (ver applyTheme em use-theme.ts) — permite
 *  que componentes como PageBackground reajam na hora, sem precisar de um Context Provider global
 *  só pra isso. */
export const THEME_CHANGE_EVENT = "filmmanager:theme-change";
