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

/** Amostra grande — cartão inteiro pinta com o page-bg do tema, 4 chips de cor em vez de 1.
 *
 *  Onda 3 — PARTE 4: a v2 (onda 2) mostrava só o accent de Planejamento, que é azul em quase
 *  todo tema — 8 dos 10 cartões pareciam iguais, a amostra escolheu justo a cor que MENOS varia.
 *  Agora são 4 chips: a cor CARACTERÍSTICA do gênero (--characteristic, ver TEMA_SWATCH — é o
 *  cromo do Horror/Thriller, o ciano do Experimental, ou o próprio pageBg quando o tema não tem
 *  cromo próprio), Planejamento, Orçamento e Erro. Cada chip leva borda própria (não só a maior)
 *  porque um chip characteristic=pageBg fica em cima do próprio fundo do cartão — sem borda,
 *  ficaria invisível. */
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
  const chips: Array<{ key: string; color: string }> = [
    { key: "characteristic", color: swatch.characteristic },
    { key: "planejamento", color: swatch.planejamento },
    { key: "orcamento", color: swatch.orcamento },
    { key: "erro", color: swatch.erro },
  ];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors",
        selected ? "border-foreground" : "border-transparent hover:border-muted-foreground/30"
      )}
      style={{ backgroundColor: swatch.pageBg }}
    >
      {selected && (
        <span
          className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full"
          style={{ backgroundColor: swatch.text }}
        >
          <Check className="h-3 w-3" style={{ color: swatch.pageBg }} />
        </span>
      )}
      <span className="flex gap-1">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="h-4 w-4 rounded-full border border-black/10 shadow-sm"
            style={{ backgroundColor: chip.color }}
          />
        ))}
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
