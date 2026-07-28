"use client";

import { useEffect, useState } from "react";

import type { Tema } from "@prisma/client";

import { isValidTema, THEME_CHANGE_EVENT } from "@/lib/theme";

function readDomTheme(): Tema {
  if (typeof document === "undefined") return "CLARO";
  const attr = document.documentElement.getAttribute("data-theme")?.toUpperCase();
  return attr && isValidTema(attr) ? attr : "CLARO";
}

/** Aplica o tema no <html> (troca instantânea via CSS, sem recarregar) e avisa quem estiver
 *  escutando THEME_CHANGE_EVENT. NÃO persiste sozinho — isso é responsabilidade de quem chama
 *  (ver ThemeSelector, que também dispara o PATCH /api/user/theme). */
export function applyTheme(tema: Tema) {
  document.documentElement.setAttribute("data-theme", tema.toLowerCase());
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: tema }));
}

/** Lê o tema atual do <html> e se mantém atualizado entre trocas — usado por componentes que
 *  precisam saber o tema ativo em tempo real (ex.: PageBackground pros orbs ocre do Histórico). */
export function useCurrentTheme(): Tema {
  const [tema, setTema] = useState<Tema>(() => readDomTheme());

  useEffect(() => {
    function handle() {
      setTema(readDomTheme());
    }
    window.addEventListener(THEME_CHANGE_EVENT, handle);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handle);
  }, []);

  return tema;
}
