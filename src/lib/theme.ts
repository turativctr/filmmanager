import type { Tema } from "@prisma/client";

/** Nome do cookie que guarda o tema — além do banco (User.tema), pra o servidor saber o tema já
 *  na primeira renderização (sem cookie, a tela piscaria no tema errado até corrigir). Ver
 *  resolução de tema em src/app/layout.tsx. */
export const THEME_COOKIE_NAME = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

export const TEMA_VALUES = ["CLARO", "NOIR", "COMEDIA", "HISTORICO"] as const;

export const TEMA_LABEL: Record<Tema, string> = {
  CLARO: "Claro",
  NOIR: "Noir",
  COMEDIA: "Comédia",
  HISTORICO: "Histórico",
};

/** Amostra de cores pro seletor no menu do usuário — mostra ao lado do nome do tema. Só decorativo,
 *  não precisa refletir TODAS as cores do tema, só dar um preview reconhecível. */
export const TEMA_SWATCH: Record<Tema, { pageBg: string; surface: string; accent: string }> = {
  CLARO: { pageBg: "#FFFFFF", surface: "#FFFFFF", accent: "#185FA5" },
  NOIR: { pageBg: "#0A0A0A", surface: "#16161A", accent: "#6B7684" },
  COMEDIA: { pageBg: "#FDFBF7", surface: "#FFFFFF", accent: "#8FAECB" },
  HISTORICO: { pageBg: "#F6F0E6", surface: "#FDFAF4", accent: "#3E5C6B" },
};

export function isValidTema(value: string): value is Tema {
  return (TEMA_VALUES as readonly string[]).includes(value);
}

/** Evento disparado sempre que o tema muda no cliente (ver applyTheme em use-theme.ts) — permite
 *  que componentes como PageBackground reajam na hora, sem precisar de um Context Provider global
 *  só pra isso. */
export const THEME_CHANGE_EVENT = "filmmanager:theme-change";
