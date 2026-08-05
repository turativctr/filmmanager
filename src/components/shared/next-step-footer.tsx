import type { ReactNode } from "react";

/** Container visual do "próximo passo" no rodapé de uma página — uma linha discreta depois do
 *  conteúdo, nunca um bloco. A página decide se renderiza (só quando há de fato pendência) e o
 *  que passa como filho: um `Link` de navegação, ou um `Link` que alterna um filtro via
 *  searchParams (ver Elenco/Figuração/Locações/Cenas). Quando há mais de um caminho legítimo
 *  (ex.: Ordem do dia — baixar PDF ou abrir modo set), os dois entram como filhos com o mesmo
 *  peso visual, sem hierarquia entre eles. */
export function NextStepFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 border-t pt-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
