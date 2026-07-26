import type { ReactNode } from "react";

import { HelpPopover } from "@/components/shared/help-popover";

/** Cabeçalho padrão de cada página de seção dentro de um projeto — título da SEÇÃO (não do
 *  projeto, que já aparece no breadcrumb do Header global) + ajuda opcional (substitui os antigos
 *  <InfoBanner> fixos) + ações à direita. Ver Visão Geral (src/app/(app)/projects/[id]/page.tsx)
 *  pela exceção: é a única página que mostra o nome do projeto, por ser o próprio assunto ali. */
export function PageHeader({
  title,
  help,
  actions,
}: {
  title: string;
  help?: { title: string; description: string };
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="flex items-center gap-1.5 text-xl font-semibold tracking-tight">
        {title}
        {help && <HelpPopover title={help.title} description={help.description} />}
      </h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
