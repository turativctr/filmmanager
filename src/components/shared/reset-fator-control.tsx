"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const QUICK_OPTIONS = [
  { value: 70, label: "Apertado 70%" },
  { value: 100, label: "Normal 100%" },
  { value: 130, label: "Folgado 130%" },
];

function fatorRitmoLabel(value: number): string {
  if (value === 100) return "";
  return value < 100 ? "dia apertado" : "dia folgado";
}

/** Nível 3 de "tempos de reset configuráveis" — decisão de ritmo do AD pra ESTA diária, não uma
 *  re-estimativa. O trigger dobra como aviso: quando `value !== 100`, fica âmbar e mostra o
 *  percentual, pra ninguém esquecer que o ritmo foi apertado/folgado e o dia "estourar". */
export function ResetFatorControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const isDefault = value === 100;

  async function commit(next: number) {
    setSaving(true);
    try {
      await onChange(next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setDraft(String(value));
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Ritmo dos resets desta diária"
          className={cn(
            "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium",
            isDefault
              ? "border-input text-muted-foreground hover:bg-secondary"
              : "border-amber-400/60 bg-amber-100 text-amber-800"
          )}
        >
          {isDefault ? "Ritmo dos resets" : `Resets a ${value}% — ${fatorRitmoLabel(value)}`}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3">
        <div>
          <p className="text-sm font-medium">Ritmo dos resets</p>
          <p className="text-xs text-muted-foreground">
            Decisão de ritmo só pra esta diária, não uma re-estimativa — ajusta o tempo de troca
            entre planos sem alterar o padrão do projeto.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={value === opt.value ? "default" : "outline"}
              disabled={saving}
              onClick={() => commit(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={500}
            className="h-8 w-20 rounded border bg-background px-2 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">%</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              const parsed = Number(draft);
              if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 500) commit(parsed);
            }}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
