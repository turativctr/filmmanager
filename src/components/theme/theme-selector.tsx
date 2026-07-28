"use client";

import type { Tema } from "@prisma/client";
import { Check, Palette } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TEMA_LABEL, TEMA_SWATCH, TEMA_VALUES } from "@/lib/theme";
import { applyTheme, useCurrentTheme } from "@/lib/use-theme";

function TemaSwatchPreview({ tema }: { tema: Tema }) {
  const swatch = TEMA_SWATCH[tema];
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 overflow-hidden rounded-full border border-black/10"
      style={{ backgroundColor: swatch.pageBg }}
      aria-hidden
    >
      <span className="h-full w-1/2" style={{ backgroundColor: swatch.accent }} />
    </span>
  );
}

/** Tema é por pessoa (não por projeto) — troca aplica na hora via CSS (ver applyTheme), sem
 *  recarregar a página, e persiste em paralelo (cookie + banco, ver PATCH /api/user/theme). */
export function ThemeSelector() {
  const { update } = useSession();
  const currentTema = useCurrentTheme();
  const [pending, setPending] = useState(false);

  async function handleSelect(tema: Tema) {
    if (tema === currentTema) return;
    applyTheme(tema);
    setPending(true);
    try {
      const res = await fetch("/api/user/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema }),
      });
      if (!res.ok) throw new Error();
      await update({ tema });
    } catch {
      toast.error("Não foi possível salvar sua preferência de tema.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Tema" disabled={pending}>
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TEMA_VALUES.map((tema) => (
          <DropdownMenuItem key={tema} onClick={() => handleSelect(tema)} className="gap-2">
            <TemaSwatchPreview tema={tema} />
            <span className="flex-1">{TEMA_LABEL[tema]}</span>
            {currentTema === tema && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
