"use client";

import { useEffect } from "react";

import type { Tema } from "@prisma/client";

import { THEME_COOKIE_MAX_AGE, THEME_COOKIE_NAME } from "@/lib/theme";

/** Só renderizado quando o cookie de tema ainda não existia nesta requisição (ver
 *  src/app/layout.tsx) — grava o cookie a partir do valor já resolvido (banco ou padrão) pra que
 *  a PRÓXIMA navegação não precise mais consultar o banco. Não muda nada visualmente: o <html> já
 *  renderizou com o data-theme certo no servidor; isso só garante que da próxima vez o cookie já
 *  esteja lá. */
export function ThemeCookieSync({ tema }: { tema: Tema }) {
  useEffect(() => {
    document.cookie = `${THEME_COOKIE_NAME}=${tema}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  }, [tema]);

  return null;
}
