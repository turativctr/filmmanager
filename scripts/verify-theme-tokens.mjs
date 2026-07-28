#!/usr/bin/env node
// Onda 3 — PARTE 1: correção estrutural pro bug que aparecia em todo tema escuro (cabeçalho de
// tabela e item de sidebar inativo ilegíveis). Causa raiz: só o Noir tinha --muted corrigido, como
// remendo pontual — os demais tokens do shadcn (--border, --secondary, --input, --popover,
// --ring, --accent) ficavam herdados do :root claro em QUALQUER outro tema, porque nunca foram
// redefinidos lá.
//
// Este script garante que isso não volta a acontecer silenciosamente: para cada tema real
// selecionável, TODOS os tokens abaixo precisam estar declarados DENTRO do próprio bloco
// `[data-theme="X"] { ... }` em globals.css — não vale herdar do :root. Roda via `npm run
// verify:themes`; falha com exit code 1 (e lista o que falta) se algum tema estiver incompleto.
//
// É uma checagem TEXTUAL (regex sobre o CSS), não um teste de browser — de propósito: é rápido,
// não depende de servidor rodando, e a garantia que importa aqui é "o valor está escrito ali",
// não "o navegador calculou certo" (isso quem garante é o CSS em si, testado visualmente à parte).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.join(__dirname, "..", "src", "app", "globals.css");

// Onda 3 — PARTE 3: DOCUMENTARIO é o novo nome de CLARO. Lista fechada dos 10 temas reais — se um
// tema novo entrar numa onda futura, adicionar aqui também (senão o script não o verifica).
const THEMES = [
  "documentario",
  "noir",
  "comedia",
  "historico",
  "drama",
  "horror",
  "fantasia",
  "thriller",
  "experimental",
  "telenovela",
];

// Conjunto exigido pela PARTE 1 do pedido — tokens do shadcn que, sem override próprio, ficam
// herdados do :root claro (bug original). --chrome-bg/--chrome-border (PARTE 2) e os tokens de
// módulo (--scheduling-*, etc.) NÃO entram aqui: aqueles já têm sua própria história de "todo
// tema define os seus" desde a onda 1, nunca foi o bug em questão.
const REQUIRED_TOKENS = [
  "--muted",
  "--muted-foreground",
  "--border",
  "--input",
  "--ring",
  "--secondary",
  "--secondary-foreground",
  "--accent",
  "--accent-foreground",
  "--popover",
  "--popover-foreground",
  "--card",
  "--card-foreground",
];

function extractThemeBlock(css, themeName) {
  // Casa `[data-theme="themeName"] { ... }` pegando o conteúdo entre chaves balanceadas — simples
  // porque os blocos de tema não têm chaves aninhadas (são só declarações `--x: y;`).
  const selectorRe = new RegExp(`\\[data-theme=["']${themeName}["']\\]\\s*\\{`);
  const match = selectorRe.exec(css);
  if (!match) return null;
  const start = match.index + match[0].length;
  const end = css.indexOf("}", start);
  if (end === -1) return null;
  return css.slice(start, end);
}

function checkTheme(css, themeName) {
  const block = extractThemeBlock(css, themeName);
  if (block === null) {
    return { themeName, found: false, missing: REQUIRED_TOKENS };
  }
  const missing = REQUIRED_TOKENS.filter((token) => {
    // Precisa ser uma DECLARAÇÃO própria (`--token:`), não só a palavra aparecendo num comentário
    // ou dentro do valor de outra variável.
    const declRe = new RegExp(`(^|[\\s;{])${token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*:`);
    return !declRe.test(block);
  });
  return { themeName, found: true, missing };
}

function main() {
  const css = readFileSync(CSS_PATH, "utf-8");
  const results = THEMES.map((t) => checkTheme(css, t));
  const failures = results.filter((r) => !r.found || r.missing.length > 0);

  for (const r of results) {
    if (!r.found) {
      console.log(`✗ ${r.themeName}: bloco [data-theme="${r.themeName}"] não encontrado em globals.css`);
    } else if (r.missing.length > 0) {
      console.log(`✗ ${r.themeName}: faltando ${r.missing.join(", ")}`);
    } else {
      console.log(`✓ ${r.themeName}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} de ${THEMES.length} temas com tokens faltando — esses tokens ficariam ` +
        `herdados do :root (tema padrão) em vez do valor próprio do tema, exatamente o bug da onda 3 ` +
        `PARTE 1. Adicionar os tokens faltando no bloco [data-theme="..."] correspondente em globals.css.`
    );
    process.exit(1);
  }

  console.log(`\nTodos os ${THEMES.length} temas definem o conjunto completo de tokens estruturais.`);
}

main();
