import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // background/foreground/card seguem o sistema de temas (--page-bg/--text/--surface, ver
        // globals.css) — é o que faz uma <Card> comum (tabela de Cenas, Locações etc.) realmente
        // trocar de superfície com o tema, não só sidebar/header/badges. border/input/ring/
        // secondary/accent/destructive/popover ficam de fora de propósito: são cinza neutro em
        // qualquer tema, não precisam retintar (e retintar --border com o branco do glass ficaria
        // errado — glass e borda de UI comum são conceitos diferentes).
        background: "rgb(var(--page-bg) / <alpha-value>)",
        foreground: "rgb(var(--text) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "rgb(var(--text-muted) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          foreground: "rgb(var(--text) / <alpha-value>)",
        },

        // Tokens de módulo — cor só entra em badges, headers de módulo, sidebar ativa e
        // cabeçalhos de PDF, nunca em fundo de página inteiro (ver src/lib/module-theme.ts e
        // src/lib/glass.ts). Cada família: bg (fundo do badge) · fg (texto) · accent (bordas/ícones).
        // Valores vêm de variáveis CSS (--x-bg/-fg/-accent em globals.css), que o tema troca via
        // data-theme no <html> — nunca hex direto aqui (ver sistema de temas em globals.css).
        // rgb(var(--x) / <alpha-value>) preserva os modificadores de opacidade do Tailwind
        // (ex.: border-scheduling-accent/30) mesmo com a cor vindo de variável.
        scheduling: {
          bg: "rgb(var(--scheduling-bg) / <alpha-value>)",
          fg: "rgb(var(--scheduling-fg) / <alpha-value>)",
          accent: "rgb(var(--scheduling-accent) / <alpha-value>)",
        },
        budgeting: {
          bg: "rgb(var(--budgeting-bg) / <alpha-value>)",
          fg: "rgb(var(--budgeting-fg) / <alpha-value>)",
          accent: "rgb(var(--budgeting-accent) / <alpha-value>)",
        },
        drafts: {
          bg: "rgb(var(--drafts-bg) / <alpha-value>)",
          fg: "rgb(var(--drafts-fg) / <alpha-value>)",
          accent: "rgb(var(--drafts-accent) / <alpha-value>)",
        },
        decupagem: {
          bg: "rgb(var(--decupagem-bg) / <alpha-value>)",
          fg: "rgb(var(--decupagem-fg) / <alpha-value>)",
          accent: "rgb(var(--decupagem-accent) / <alpha-value>)",
        },
        alerta: {
          bg: "rgb(var(--alerta-bg) / <alpha-value>)",
          fg: "rgb(var(--alerta-fg) / <alpha-value>)",
          accent: "rgb(var(--alerta-accent) / <alpha-value>)",
        },
        erro: {
          bg: "rgb(var(--erro-bg) / <alpha-value>)",
          fg: "rgb(var(--erro-fg) / <alpha-value>)",
          accent: "rgb(var(--erro-accent) / <alpha-value>)",
        },
        sucesso: {
          bg: "rgb(var(--sucesso-bg) / <alpha-value>)",
          fg: "rgb(var(--sucesso-fg) / <alpha-value>)",
          accent: "rgb(var(--sucesso-accent) / <alpha-value>)",
        },
        neutro: {
          bg: "rgb(var(--neutro-bg) / <alpha-value>)",
          fg: "rgb(var(--neutro-fg) / <alpha-value>)",
          accent: "rgb(var(--neutro-accent) / <alpha-value>)",
        },

        // Superfície/página do sistema de temas (ver globals.css) — mesmas variáveis que
        // background/foreground/card acima; expostas também com esses nomes porque
        // PageBackground e src/lib/glass.ts (glass é translúcido, não pode usar bg-card puro)
        // precisam referenciar --page-bg/--surface/--text diretamente.
        "page-bg": "rgb(var(--page-bg) / <alpha-value>)",
        // 3 stops do gradiente do PageBackground — CLARO usa branco/branco/zinc-50 (mantém o
        // gradiente sutil de sempre); os outros 3 temas colapsam os 3 num --page-bg liso (ver
        // globals.css). Ficam em CSS puro (não numa classe condicional em JS por tema) de
        // propósito: o primeiro render no servidor não tem acesso a `document`, então uma
        // decisão em React ficaria errada até a hidratação corrigir depois — como variável CSS,
        // o navegador já aplica certo direto do HTML do servidor, sem flash.
        "page-bg-from": "rgb(var(--page-bg-from) / <alpha-value>)",
        "page-bg-via": "rgb(var(--page-bg-via) / <alpha-value>)",
        "page-bg-to": "rgb(var(--page-bg-to) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-border": "rgb(var(--surface-border) / <alpha-value>)",
        ink: "rgb(var(--text) / <alpha-value>)",
        "ink-muted": "rgb(var(--text-muted) / <alpha-value>)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
