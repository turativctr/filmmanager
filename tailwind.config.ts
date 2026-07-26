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
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
          foreground: "hsl(var(--muted-foreground))",
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
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Tokens de módulo — cor só entra em badges, headers de módulo, sidebar ativa e
        // cabeçalhos de PDF, nunca em fundo de página inteiro (ver src/lib/module-theme.ts e
        // src/lib/glass.ts). Cada família: bg (fundo do badge) · fg (texto) · accent (bordas/ícones).
        scheduling: { bg: "#E6F1FB", fg: "#0C447C", accent: "#185FA5" },
        budgeting: { bg: "#EAF3DE", fg: "#27500A", accent: "#3B6D11" },
        drafts: { bg: "#EEEDFE", fg: "#3C3489", accent: "#534AB7" },
        decupagem: { bg: "#E3F3F0", fg: "#0F4F45", accent: "#1B7365" },
        alerta: { bg: "#FAEEDA", fg: "#633806", accent: "#854F0B" },
        erro: { bg: "#FAECE7", fg: "#993C1D", accent: "#A32D2D" },
        sucesso: { bg: "#EAF3DE", fg: "#3B6D11", accent: "#3B6D11" },
        neutro: { bg: "#F4F4F5", fg: "#52525B", accent: "#A1A1AA" },
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
