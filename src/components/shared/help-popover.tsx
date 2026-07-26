"use client";

import { HelpCircle } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Substitui o antigo <InfoBanner> fixo no fluxo da página — mesmo conteúdo (título + descrição),
 *  agora atrás de um ícone (?) ao lado do H1 da seção, sob demanda em vez de sempre ocupando
 *  ~100px de altura. Sem persistência de "já vi" — abrir/fechar já é o próprio estado. */
export function HelpPopover({ title, description }: { title: string; description: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label={`Sobre ${title}`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="mb-1 font-semibold">{title}</p>
        <p className="text-muted-foreground">{description}</p>
      </PopoverContent>
    </Popover>
  );
}
