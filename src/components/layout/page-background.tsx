"use client";

import { usePathname } from "next/navigation";

import { getActiveModule, MODULE_ACCENT_VAR } from "@/lib/module-theme";

/** Gradiente/fundo + 2 orbs decorativos na cor do módulo ativo (opacidade varia por tema — ver
 *  --orb-opacity em globals.css) — nunca colore o fundo da página inteira, só esses dois círculos
 *  borrados fora do fluxo. Ausente do layout (set-mode) de propósito — ver a exceção obrigatória
 *  do Modo de Set em src/app/(set-mode)/layout.tsx.
 *
 *  Todo o resto que varia por tema (o gradiente do DOCUMENTÁRIO vs. fundo liso dos outros, e o
 *  ocre fixo dos orbs no Histórico) é resolvido em CSS puro (ver --page-bg-from/via/to e
 *  --orb-accent-override em globals.css), NUNCA por um `if (tema === ...)` em JS aqui —
 *  o primeiro render no servidor não tem acesso a `document`/data-theme, então uma decisão
 *  em React ficaria presa no valor padrão (DOCUMENTÁRIO) até a hidratação corrigir, e na prática
 *  isso NÃO corrige sozinho (fica errado até um reload) — variável CSS não tem esse problema,
 *  o navegador já aplica certo direto do HTML que o servidor mandou. */
export function PageBackground() {
  const pathname = usePathname();
  const activeModule = getActiveModule(pathname);
  const moduleAccent = activeModule ? MODULE_ACCENT_VAR[activeModule] : "rgb(var(--neutro-accent))";
  // --orb-accent-override só existe no Histórico (ver globals.css) — nos outros temas o var()
  // cai no fallback (a cor do módulo ativo), que é o comportamento de sempre.
  const accent = `var(--orb-accent-override, ${moduleAccent})`;

  return (
    <div className="bg-gradient-to-br from-page-bg-from via-page-bg-via to-page-bg-to pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute -left-40 -top-40 h-96 w-96 rounded-full blur-3xl"
        style={{ backgroundColor: accent, opacity: "var(--orb-opacity)" }}
      />
      <div
        className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full blur-3xl"
        style={{ backgroundColor: accent, opacity: "var(--orb-opacity)" }}
      />
    </div>
  );
}
