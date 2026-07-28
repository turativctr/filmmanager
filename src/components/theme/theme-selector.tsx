"use client";

import type { Tema } from "@prisma/client";
import { Check, Palette } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TEMA_LABEL, TEMA_SWATCH, TEMA_VALUES } from "@/lib/theme";
import { applyTheme, useCurrentTheme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

/** Amostra grande — cartão inteiro pinta com o page-bg do tema, círculo colorido no accent.
 *  Precisa ser maior que a versão de dropdown de 1 tema (onda 1): com 10 opções o usuário
 *  escolhe pelo clima visual, não só pelo nome, então o preview precisa carregar peso. */
function TemaCard({
  tema,
  selected,
  onSelect,
}: {
  tema: Tema;
  selected: boolean;
  onSelect: () => void;
}) {
  const swatch = TEMA_SWATCH[tema];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors",
        selected ? "border-foreground" : "border-transparent hover:border-muted-foreground/30"
      )}
      style={{ backgroundColor: swatch.pageBg }}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 shadow-sm"
        style={{ backgroundColor: swatch.accent }}
      >
        {selected && <Check className="h-4 w-4" style={{ color: swatch.pageBg }} />}
      </span>
      <span className="text-xs font-medium" style={{ color: swatch.text }}>
        {TEMA_LABEL[tema]}
      </span>
    </button>
  );
}

/** Tema é por pessoa (não por projeto) — troca aplica na hora via CSS (ver applyTheme), sem
 *  recarregar a página, e persiste em paralelo (cookie + banco, ver PATCH /api/user/theme).
 *  Onda 2: 10 temas não cabem mais num dropdown de lista única sem ficar gigante e ilegível
 *  (o usuário escolhe pelo clima visual — precisa de um preview grande, não uma linha de
 *  texto com um círculo de 4px) — virou diálogo com grade de amostras (ver PARTE 3 do pedido:
 *  "decidir vendo" — decidido depois de ver o dropdown de 10 itens ficar comprido demais). */
export function ThemeSelector() {
  const { update } = useSession();
  const currentTema = useCurrentTheme();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSelect(tema: Tema) {
    if (tema === currentTema) {
      setOpen(false);
      return;
    }
    applyTheme(tema);
    setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" title="Tema" disabled={pending} onClick={() => setOpen(true)}>
        <Palette className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Escolher tema</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {TEMA_VALUES.map((tema) => (
            <TemaCard
              key={tema}
              tema={tema}
              selected={currentTema === tema}
              onSelect={() => handleSelect(tema)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
